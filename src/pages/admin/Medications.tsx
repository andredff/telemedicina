import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Pill, Plus, Pencil, Trash2, Search, Upload, FileSpreadsheet,
  AlertCircle, CheckCircle2, X, RefreshCw, Download,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { MedicationCatalog, MedicationImportRow, PharmacyFull } from '@/types/inventory';
import {
  getMedicationCatalog, getPharmacies, deleteMedication,
  updateMedication, upsertMedication, bulkUpsertMedications,
  getMedicationCategories,
} from '@/services/inventoryService';
import { cn } from '@/lib/utils';

// ── Required Excel columns (header names as they appear in the spreadsheet) ──
//
//  ID | Nome do Medicamento | Princípio Ativo | Categoria | Dosagem |
//  Forma Farmacêutica | Lote | Validade | Estoque Atual | Fornecedor
//
const EXCEL_COL_MAP: Record<string, keyof MedicationImportRow> = {
  'id':                    'external_id',
  'nome do medicamento':   'name',
  'principio ativo':       'active_ingredient',
  'princípio ativo':       'active_ingredient',
  'categoria':             'category',
  'dosagem':               'dosage',
  'forma farmaceutica':    'form',
  'forma farmacêutica':    'form',
  'lote':                  'batch',
  'validade':              'expiry_date',
  'estoque atual':         'stock',
  'estoque':               'stock',
  'fornecedor':            'supplier',
};

function normalizeHeader(h: string): string {
  return h.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Parse a validade field: accepts Date serial, ISO string, dd/mm/yyyy, mm/yyyy */
function parseExpiry(raw: string | number): { iso: string; error: boolean } {
  if (!raw && raw !== 0) return { iso: '', error: false };

  // Excel date serial
  if (typeof raw === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(raw);
      if (d) {
        const iso = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        return { iso, error: false };
      }
    } catch {
      // fall through
    }
  }

  const str = String(raw).trim();

  // dd/mm/yyyy or d/m/yyyy
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return { iso, error: isNaN(Date.parse(iso)) };
  }

  // mm/yyyy  → use last day of month
  const my = str.match(/^(\d{1,2})\/(\d{4})$/);
  if (my) {
    const iso = `${my[2]}-${my[1].padStart(2, '0')}-01`;
    return { iso, error: isNaN(Date.parse(iso)) };
  }

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return { iso: str, error: isNaN(Date.parse(str)) };
  }

  return { iso: str, error: true };
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['ID', 'Nome do Medicamento', 'Princípio Ativo', 'Categoria', 'Dosagem',
     'Forma Farmacêutica', 'Lote', 'Validade', 'Estoque Atual', 'Fornecedor'],
    ['MED001', 'Paracetamol 500mg', 'Paracetamol', 'Analgésico', '500mg',
     'Comprimido', 'L2024A', '12/2026', 100, 'EMS'],
    ['MED002', 'Amoxicilina 500mg', 'Amoxicilina', 'Antibiótico', '500mg',
     'Cápsula', 'L2024B', '06/2026', 50, 'Medley'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Medicamentos');
  XLSX.writeFile(wb, 'modelo_medicamentos.xlsx');
}

export default function AdminMedications() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Catalog state
  const [medications, setMedications] = useState<MedicationCatalog[]>([]);
  const [pharmacies, setPharmacies] = useState<PharmacyFull[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, _setSearch] = useState('');
  const [filterPharmacy, _setFilterPharmacy] = useState('');
  const [filterCategory, _setFilterCategory] = useState('');

  // Edit dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicationCatalog | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', active_ingredient: '', category: '', dosage: '',
    form: '', batch: '', expiry_date: '', stock: 0,
    supplier: '', manufacturer: '', price: 0,
    pharmacy_id: '' as string | null,
  });
  const [saving, setSaving] = useState(false);

  // Import state
  const [importRows, setImportRows] = useState<MedicationImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [meds, pharmas, cats] = await Promise.all([
      getMedicationCatalog(),
      getPharmacies(),
      getMedicationCategories(),
    ]);
    setMedications(meds);
    setPharmacies(pharmas);
    setCategories(cats);
    setLoading(false);
  }

  // ── Excel parsing ──────────────────────────────────────────────────────────

  function parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw: Record<string, string | number>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (raw.length === 0) {
          toast({ title: 'Planilha vazia', variant: 'destructive' });
          return;
        }

        // Build original-header → field map
        const firstRow = raw[0];
        const headerToField: Record<string, keyof MedicationImportRow> = {};
        Object.keys(firstRow).forEach((h) => {
          const norm = normalizeHeader(h);
          const field = EXCEL_COL_MAP[norm];
          if (field) headerToField[h] = field;
        });

        const get = (row: Record<string, string | number>, field: keyof MedicationImportRow): string => {
          const key = Object.keys(headerToField).find((h) => headerToField[h] === field);
          return key ? String(row[key] ?? '').trim() : '';
        };

        const getRaw = (row: Record<string, string | number>, field: keyof MedicationImportRow): string | number => {
          const key = Object.keys(headerToField).find((h) => headerToField[h] === field);
          return key ? row[key] ?? '' : '';
        };

        const rows: MedicationImportRow[] = [];

        for (let idx = 0; idx < raw.length; idx++) {
          const rawRow = raw[idx];
          const name = get(rawRow, 'name');

          // Skip rows without name (as per spec)
          if (!name) continue;

          const errors: string[] = [];

          const stockRaw = get(rawRow, 'stock');
          const stockNum = parseInt(stockRaw, 10);
          const stock = isNaN(stockNum) || stockNum < 0 ? 0 : stockNum;
          if (isNaN(stockNum) || stockNum < 0) errors.push('Estoque inválido → definido como 0');

          const expiryRaw = getRaw(rawRow, 'expiry_date');
          const { iso: expiryIso, error: expiryError } = parseExpiry(expiryRaw);
          if (expiryRaw !== '' && expiryError) errors.push('Data de validade inválida');

          rows.push({
            row: idx + 2, // +2: header is row 1, data starts at row 2
            external_id: get(rawRow, 'external_id'),
            name,
            active_ingredient: get(rawRow, 'active_ingredient'),
            category: get(rawRow, 'category'),
            dosage: get(rawRow, 'dosage'),
            form: get(rawRow, 'form'),
            batch: get(rawRow, 'batch'),
            expiry_date: expiryIso,
            stock,
            supplier: get(rawRow, 'supplier'),
            errors,
          });
        }

        if (rows.length === 0) {
          toast({ title: 'Nenhuma linha com nome encontrada', variant: 'destructive' });
          return;
        }

        setImportRows(rows);
        setShowImportPreview(true);
      } catch {
        toast({ title: 'Erro ao ler arquivo', description: 'Verifique se é um arquivo .xlsx válido.', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcel(file);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseExcel(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Import confirmation ────────────────────────────────────────────────────

  async function confirmImport() {
    // Rows with date errors are still imported (only truly invalid dates block)
    const importable = importRows.filter((r) => !r.errors.some((e) => e.startsWith('Data de validade inválida') && r.expiry_date === ''));
    if (importable.length === 0) {
      toast({ title: 'Nenhuma linha válida para importar', variant: 'destructive' });
      return;
    }

    setImporting(true);
    setImportProgress(0);

    try {
      // Default pharmacy: first available, or null
      const defaultPharmacyId = pharmacies[0]?.id ?? null;

      // Deduplicate by (name, dosage) — keep last occurrence (mirrors upsert behaviour)
      const seen = new Map<string, typeof importable[number]>();
      for (const r of importable) {
        const key = `${r.name.toLowerCase()}||${(r.dosage || '').toLowerCase()}`;
        seen.set(key, r);
      }
      const deduped = Array.from(seen.values());

      const payload = deduped.map((r) => ({
        external_id: r.external_id || null,
        name: r.name,
        active_ingredient: r.active_ingredient || null,
        category: r.category || null,
        dosage: r.dosage || null,
        form: r.form || null,
        batch: r.batch || null,
        expiry_date: r.expiry_date || null,
        stock: r.stock,
        supplier: r.supplier || null,
        manufacturer: null,
        price: 0,
        pharmacy_id: defaultPharmacyId,
      }));

      const chunkSize = 50;
      for (let i = 0; i < payload.length; i += chunkSize) {
        await bulkUpsertMedications(payload.slice(i, i + chunkSize));
        setImportProgress(Math.min(100, Math.round(((i + chunkSize) / payload.length) * 100)));
      }

      const n = deduped.length;
      toast({
        title: `${n} medicamento${n !== 1 ? 's' : ''} importado${n !== 1 ? 's' : ''} com sucesso!`,
        description: deduped.length < importable.length
          ? `${importable.length - deduped.length} duplicado${importable.length - deduped.length !== 1 ? 's' : ''} consolidado${importable.length - deduped.length !== 1 ? 's' : ''}.`
          : undefined,
      });
      setShowImportPreview(false);
      setImportRows([]);
      loadAll();
    } catch (err) {
      toast({ title: 'Erro na importação', description: String(err), variant: 'destructive' });
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  }

  // ── Edit / create ──────────────────────────────────────────────────────────

  function openEdit(med: MedicationCatalog) {
    setEditingMed(med);
    setEditForm({
      name: med.name,
      active_ingredient: med.active_ingredient ?? '',
      category: med.category ?? '',
      dosage: med.dosage ?? '',
      form: med.form ?? '',
      batch: med.batch ?? '',
      expiry_date: med.expiry_date ?? '',
      stock: med.stock,
      supplier: med.supplier ?? '',
      manufacturer: med.manufacturer ?? '',
      price: med.price,
      pharmacy_id: med.pharmacy_id,
    });
    setShowEditDialog(true);
  }

  function openNew() {
    setEditingMed(null);
    setEditForm({
      name: '', active_ingredient: '', category: '', dosage: '',
      form: '', batch: '', expiry_date: '', stock: 0,
      supplier: '', manufacturer: '', price: 0, pharmacy_id: null,
    });
    setShowEditDialog(true);
  }

  async function saveMed() {
    if (!editForm.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      external_id: null as string | null,
      name: editForm.name,
      active_ingredient: editForm.active_ingredient || null,
      category: editForm.category || null,
      dosage: editForm.dosage || null,
      form: editForm.form || null,
      batch: editForm.batch || null,
      expiry_date: editForm.expiry_date || null,
      stock: editForm.stock,
      supplier: editForm.supplier || null,
      manufacturer: editForm.manufacturer || null,
      price: editForm.price,
      pharmacy_id: editForm.pharmacy_id || null,
    };
    if (editingMed) {
      await updateMedication(editingMed.id, payload);
      toast({ title: 'Medicamento atualizado' });
    } else {
      await upsertMedication(payload);
      toast({ title: 'Medicamento cadastrado' });
    }
    setSaving(false);
    setShowEditDialog(false);
    loadAll();
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este medicamento?')) return;
    await deleteMedication(id);
    toast({ title: 'Medicamento excluído' });
    loadAll();
  }

  // ── Filter + pagination ────────────────────────────────────────────────────

  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = medications.filter((m) => {
    const matchSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.active_ingredient ?? '').toLowerCase().includes(search.toLowerCase());
    const matchPharmacy = !filterPharmacy || m.pharmacy_id === filterPharmacy;
    const matchCategory = !filterCategory || m.category === filterCategory;
    return matchSearch && matchPharmacy && matchCategory;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when filters change
  const setSearch = (v: string) => { _setSearch(v); setCurrentPage(1); };
  const setFilterPharmacy = (v: string) => { _setFilterPharmacy(v); setCurrentPage(1); };
  const setFilterCategory = (v: string) => { _setFilterCategory(v); setCurrentPage(1); };

  const validCount = importRows.filter((r) => r.errors.length === 0).length;
  const errorCount = importRows.filter((r) => r.errors.length > 0).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Pill className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Catálogo de Medicamentos</h1>
            <p className="text-sm text-gray-500">
              {medications.length} medicamento{medications.length !== 1 ? 's' : ''} cadastrado{medications.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" />Modelo Excel
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />Importar Excel
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />Novo Medicamento
          </Button>
        </div>
      </div>

      {/* Drag & drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50'
        )}
      >
        <Upload className={cn('h-9 w-9 mx-auto mb-3', isDragging ? 'text-primary' : 'text-gray-400')} />
        <p className="text-sm font-medium text-gray-700">
          {isDragging ? 'Solte o arquivo aqui' : 'Arraste um .xlsx aqui ou clique para selecionar'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Colunas esperadas: ID · Nome do Medicamento · Princípio Ativo · Categoria · Dosagem · Forma Farmacêutica · Lote · Validade · Estoque Atual · Fornecedor
        </p>
        <p className="text-xs text-gray-400">Use o botão "Modelo Excel" para baixar o template correto.</p>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileInput} />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <Input
                placeholder="Buscar medicamento ou princípio ativo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={filterPharmacy}
              onChange={(e) => setFilterPharmacy(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-white min-w-[180px]"
            >
              <option value="">Todas as farmácias</option>
              {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-white min-w-[160px]"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {(search || filterPharmacy || filterCategory) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterPharmacy(''); setFilterCategory(''); setCurrentPage(1); }}>
                <X className="h-4 w-4 mr-1" />Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 py-12">
              {medications.length === 0
                ? 'Nenhum medicamento cadastrado. Importe um Excel para começar.'
                : 'Nenhum resultado encontrado.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicamento</TableHead>
                  <TableHead>Forma / Lote</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((med) => (
                  <TableRow key={med.id}>
                    <TableCell>
                      <p className="font-medium">{med.name}</p>
                      {med.active_ingredient && <p className="text-xs text-gray-500">{med.active_ingredient}</p>}
                      {med.dosage && <p className="text-xs text-gray-400">{med.dosage}</p>}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span>{med.form ?? '—'}</span>
                      {med.batch && <p className="text-xs text-gray-400">Lote: {med.batch}</p>}
                    </TableCell>
                    <TableCell>
                      {med.category
                        ? <Badge variant="outline" className="text-xs">{med.category}</Badge>
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {med.expiry_date
                        ? new Date(med.expiry_date).toLocaleDateString('pt-BR')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{med.supplier ?? med.pharmacy_name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={med.stock > 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                        {med.stock > 0 ? `${med.stock} un.` : 'Sem estoque'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(med)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(med.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
            <span>
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-gray-400">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === safePage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(p as number)}
                      className="h-8 w-8 p-0"
                    >
                      {p}
                    </Button>
                  )
                )}
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Import Preview Dialog ── */}
      <Dialog
        open={showImportPreview}
        onOpenChange={(open) => { if (!open && !importing) { setShowImportPreview(false); setImportRows([]); } }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Preview da Importação
            </DialogTitle>
          </DialogHeader>

          {/* Summary badges */}
          <div className="flex flex-wrap gap-3 py-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-green-800">{validCount} sem erros</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">{errorCount} com avisos</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border">
              <span className="text-sm text-gray-600">{importRows.length} linhas lidas</span>
            </div>
            <p className="text-xs text-gray-500 self-center ml-auto">
              Duplicados (mesmo nome + dosagem) serão <strong>atualizados</strong>.
            </p>
          </div>

          {/* Progress bar */}
          {importing && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Importando...</span>
                <span>{importProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-auto flex-1 border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Linha</TableHead>
                  <TableHead>ID Externo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Princípio Ativo</TableHead>
                  <TableHead>Dosagem</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importRows.map((row) => (
                  <TableRow key={row.row} className={row.errors.length > 0 ? 'bg-amber-50/60' : ''}>
                    <TableCell className="text-xs text-gray-500">{row.row}</TableCell>
                    <TableCell className="text-xs text-gray-400">{row.external_id || '—'}</TableCell>
                    <TableCell className="font-medium text-sm">{row.name}</TableCell>
                    <TableCell className="text-sm text-gray-600">{row.active_ingredient || '—'}</TableCell>
                    <TableCell className="text-sm">{row.dosage || '—'}</TableCell>
                    <TableCell className="text-sm">{row.form || '—'}</TableCell>
                    <TableCell className="text-sm">{row.batch || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {row.expiry_date
                        ? (() => { try { return new Date(row.expiry_date).toLocaleDateString('pt-BR'); } catch { return row.expiry_date; } })()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{row.stock}</TableCell>
                    <TableCell className="text-sm">{row.supplier || '—'}</TableCell>
                    <TableCell>
                      {row.errors.length === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <div className="flex items-start gap-1">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            {row.errors.map((err, i) => (
                              <p key={i} className="text-xs text-amber-700">{err}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => { setShowImportPreview(false); setImportRows([]); }}
              disabled={importing}
            >
              Cancelar
            </Button>
            {errorCount > 0 && (
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />Reprocessar arquivo
              </Button>
            )}
            <Button
              onClick={confirmImport}
              disabled={importing || importRows.length === 0}
              className="gap-2 min-w-[180px]"
            >
              {importing ? (
                <><RefreshCw className="h-4 w-4 animate-spin" />Importando...</>
              ) : (
                <><Upload className="h-4 w-4" />Importar {importRows.length} medicamento{importRows.length !== 1 ? 's' : ''}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit / New Medication Dialog ── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMed ? 'Editar Medicamento' : 'Novo Medicamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Paracetamol 500mg"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Princípio Ativo</Label>
                <Input value={editForm.active_ingredient} onChange={(e) => setEditForm((p) => ({ ...p, active_ingredient: e.target.value }))} placeholder="Ex: Paracetamol" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))} placeholder="Ex: Analgésico" />
              </div>
              <div>
                <Label>Dosagem</Label>
                <Input value={editForm.dosage} onChange={(e) => setEditForm((p) => ({ ...p, dosage: e.target.value }))} placeholder="Ex: 500mg" />
              </div>
              <div>
                <Label>Forma Farmacêutica</Label>
                <Input value={editForm.form} onChange={(e) => setEditForm((p) => ({ ...p, form: e.target.value }))} placeholder="Ex: Comprimido" />
              </div>
              <div>
                <Label>Lote</Label>
                <Input value={editForm.batch} onChange={(e) => setEditForm((p) => ({ ...p, batch: e.target.value }))} placeholder="Ex: L2024A" />
              </div>
              <div>
                <Label>Validade</Label>
                <Input type="date" value={editForm.expiry_date} onChange={(e) => setEditForm((p) => ({ ...p, expiry_date: e.target.value }))} />
              </div>
              <div>
                <Label>Estoque (unidades)</Label>
                <Input type="number" min={0} value={editForm.stock} onChange={(e) => setEditForm((p) => ({ ...p, stock: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" min={0} step={0.01} value={editForm.price} onChange={(e) => setEditForm((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input value={editForm.supplier} onChange={(e) => setEditForm((p) => ({ ...p, supplier: e.target.value }))} placeholder="Ex: EMS" />
            </div>
            <div>
              <Label>Fabricante</Label>
              <Input value={editForm.manufacturer} onChange={(e) => setEditForm((p) => ({ ...p, manufacturer: e.target.value }))} placeholder="Ex: EMS Sigma Pharma" />
            </div>
            <div>
              <Label>Farmácia</Label>
              <select
                value={editForm.pharmacy_id ?? ''}
                onChange={(e) => setEditForm((p) => ({ ...p, pharmacy_id: e.target.value || null }))}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">Sem farmácia vinculada</option>
                {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={saveMed} disabled={saving || !editForm.name}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
