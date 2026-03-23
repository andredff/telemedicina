import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Pill, Plus, Pencil, Trash2, Search, Upload, FileSpreadsheet,
  AlertCircle, CheckCircle2, X, RefreshCw, Download,
} from 'lucide-react';
import { MedicationCatalog, MedicationImportRow, PharmacyFull } from '@/types/inventory';
import {
  getMedicationCatalog, getPharmacies, deleteMedication,
  updateMedication, upsertMedication, bulkInsertMedications,
  getMedicationCategories,
} from '@/services/inventoryService';
import { cn } from '@/lib/utils';

// ── Expected Excel columns (case-insensitive) ──────────────────────────────
const EXPECTED_COLS = ['nome', 'principio_ativo', 'categoria', 'dosagem', 'fabricante', 'preco', 'estoque', 'farmacia'];

function normalizeHeader(h: string): string {
  return h.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/ã/g, 'a').replace(/ç/g, 'c').replace(/ê/g, 'e')
    .replace(/ú/g, 'u').replace(/á/g, 'a').replace(/é/g, 'e')
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/[^a-z0-9_]/g, '');
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nome', 'Principio Ativo', 'Categoria', 'Dosagem', 'Fabricante', 'Preco', 'Estoque', 'Farmacia'],
    ['Paracetamol 500mg', 'Paracetamol', 'Analgésico', '500mg', 'EMS', '8.90', '100', 'Farmácia Saúde'],
    ['Amoxicilina 500mg', 'Amoxicilina', 'Antibiótico', '500mg', 'Medley', '22.50', '50', 'Farmácia Saúde'],
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
  const [search, setSearch] = useState('');
  const [filterPharmacy, setFilterPharmacy] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Edit dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicationCatalog | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', active_ingredient: '', category: '', dosage: '',
    manufacturer: '', price: 0, stock: 0, pharmacy_id: '' as string | null,
  });
  const [saving, setSaving] = useState(false);

  // Import state
  const [importRows, setImportRows] = useState<MedicationImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

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

  // ── Excel parsing ─────────────────────────────────────────────────────────

  function parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw: Record<string, string | number>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (raw.length === 0) {
          toast({ title: 'Planilha vazia', variant: 'destructive' });
          return;
        }

        // Map headers
        const firstRow = raw[0];
        const headerMap: Record<string, string> = {};
        Object.keys(firstRow).forEach((h) => {
          const norm = normalizeHeader(h);
          EXPECTED_COLS.forEach((col) => {
            if (norm.includes(col) || col.includes(norm)) headerMap[h] = col;
          });
        });

        const rows: MedicationImportRow[] = raw.map((rawRow, idx) => {
          const get = (col: string) => {
            const key = Object.keys(headerMap).find((h) => headerMap[h] === col);
            return key ? String(rawRow[key] ?? '').trim() : '';
          };

          const errors: string[] = [];
          const name = get('nome');
          const priceRaw = get('preco').replace(',', '.');
          const stockRaw = get('estoque');
          const price = parseFloat(priceRaw);
          const stock = parseInt(stockRaw, 10);

          if (!name) errors.push('Nome obrigatório');
          if (isNaN(price) || price < 0) errors.push('Preço inválido');
          if (isNaN(stock) || stock < 0) errors.push('Estoque inválido');

          return {
            row: idx + 2,
            name,
            active_ingredient: get('principio_ativo'),
            category: get('categoria'),
            dosage: get('dosagem'),
            manufacturer: get('fabricante'),
            price: isNaN(price) ? 0 : price,
            stock: isNaN(stock) ? 0 : stock,
            pharmacy_name: get('farmacia'),
            errors,
          };
        });

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
  }, [pharmacies]);

  async function confirmImport() {
    const valid = importRows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) {
      toast({ title: 'Nenhuma linha válida para importar', variant: 'destructive' });
      return;
    }
    setImporting(true);
    setImportProgress(0);

    try {
      // Build pharmacy name → id map
      const pharmacyMap: Record<string, string | null> = {};
      pharmacies.forEach((p) => { pharmacyMap[p.name.toLowerCase()] = p.id; });

      const payload = valid.map((r) => ({
        name: r.name,
        active_ingredient: r.active_ingredient || null,
        category: r.category || null,
        dosage: r.dosage || null,
        manufacturer: r.manufacturer || null,
        price: r.price,
        stock: r.stock,
        pharmacy_id: r.pharmacy_name
          ? (pharmacyMap[r.pharmacy_name.toLowerCase()] ?? null)
          : null,
      }));

      // Insert in chunks of 50 for progress feedback
      const chunkSize = 50;
      for (let i = 0; i < payload.length; i += chunkSize) {
        await bulkInsertMedications(payload.slice(i, i + chunkSize));
        setImportProgress(Math.round(((i + chunkSize) / payload.length) * 100));
      }

      toast({ title: `${valid.length} medicamento${valid.length !== 1 ? 's' : ''} importado${valid.length !== 1 ? 's' : ''} com sucesso!` });
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

  // ── Edit / create ─────────────────────────────────────────────────────────

  function openEdit(med: MedicationCatalog) {
    setEditingMed(med);
    setEditForm({
      name: med.name, active_ingredient: med.active_ingredient ?? '',
      category: med.category ?? '', dosage: med.dosage ?? '',
      manufacturer: med.manufacturer ?? '', price: med.price,
      stock: med.stock, pharmacy_id: med.pharmacy_id,
    });
    setShowEditDialog(true);
  }

  function openNew() {
    setEditingMed(null);
    setEditForm({ name: '', active_ingredient: '', category: '', dosage: '', manufacturer: '', price: 0, stock: 0, pharmacy_id: null });
    setShowEditDialog(true);
  }

  async function saveMed() {
    if (!editForm.name.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      name: editForm.name, active_ingredient: editForm.active_ingredient || null,
      category: editForm.category || null, dosage: editForm.dosage || null,
      manufacturer: editForm.manufacturer || null, price: editForm.price,
      stock: editForm.stock, pharmacy_id: editForm.pharmacy_id || null,
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

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = medications.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.active_ingredient ?? '').toLowerCase().includes(search.toLowerCase());
    const matchPharmacy = !filterPharmacy || m.pharmacy_id === filterPharmacy;
    const matchCategory = !filterCategory || m.category === filterCategory;
    return matchSearch && matchPharmacy && matchCategory;
  });

  const validCount = importRows.filter((r) => r.errors.length === 0).length;
  const errorCount = importRows.filter((r) => r.errors.length > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Pill className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Catálogo de Medicamentos</h1>
            <p className="text-sm text-gray-500">{medications.length} medicamento{medications.length !== 1 ? 's' : ''} cadastrado{medications.length !== 1 ? 's' : ''}</p>
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
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
          isDragging ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50'
        )}
      >
        <Upload className={cn('h-8 w-8 mx-auto mb-2', isDragging ? 'text-primary' : 'text-gray-400')} />
        <p className="text-sm font-medium text-gray-600">
          {isDragging ? 'Solte o arquivo aqui' : 'Arraste um .xlsx aqui ou clique para selecionar'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Use o botão "Modelo Excel" para baixar o template correto</p>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileInput} />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <Input placeholder="Buscar medicamento ou princípio ativo..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterPharmacy(''); setFilterCategory(''); }}>
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
              {medications.length === 0 ? 'Nenhum medicamento cadastrado. Importe um Excel para começar.' : 'Nenhum resultado encontrado.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicamento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Farmácia</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((med) => (
                  <TableRow key={med.id}>
                    <TableCell>
                      <p className="font-medium">{med.name}</p>
                      {med.active_ingredient && <p className="text-xs text-gray-500">{med.active_ingredient}</p>}
                      {med.dosage && <p className="text-xs text-gray-400">{med.dosage}</p>}
                    </TableCell>
                    <TableCell>
                      {med.category ? (
                        <Badge variant="outline" className="text-xs">{med.category}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{med.pharmacy_name ?? '—'}</TableCell>
                    <TableCell className="font-medium text-green-700">R$ {med.price.toFixed(2)}</TableCell>
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
      </Card>

      {/* ── Import Preview Dialog ── */}
      <Dialog open={showImportPreview} onOpenChange={(open) => { if (!open && !importing) { setShowImportPreview(false); setImportRows([]); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Preview da Importação
            </DialogTitle>
          </DialogHeader>

          {/* Summary */}
          <div className="flex gap-3 py-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-green-800">{validCount} válidos</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-red-800">{errorCount} com erro</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border">
              <span className="text-sm text-gray-600">{importRows.length} linhas no total</span>
            </div>
          </div>

          {/* Progress bar */}
          {importing && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Importando...</span>
                <span>{importProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-auto flex-1 border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Linha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Princípio Ativo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Farmácia</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importRows.map((row) => (
                  <TableRow key={row.row} className={row.errors.length > 0 ? 'bg-red-50' : ''}>
                    <TableCell className="text-xs text-gray-500">{row.row}</TableCell>
                    <TableCell className="font-medium text-sm">{row.name || '—'}</TableCell>
                    <TableCell className="text-sm text-gray-600">{row.active_ingredient || '—'}</TableCell>
                    <TableCell className="text-sm">{row.category || '—'}</TableCell>
                    <TableCell className="text-sm">R$ {row.price.toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{row.stock}</TableCell>
                    <TableCell className="text-sm">{row.pharmacy_name || '—'}</TableCell>
                    <TableCell>
                      {row.errors.length === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <div className="flex items-start gap-1">
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            {row.errors.map((err, i) => (
                              <p key={i} className="text-xs text-red-600">{err}</p>
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
            <Button variant="outline" onClick={() => { setShowImportPreview(false); setImportRows([]); }} disabled={importing}>
              Cancelar
            </Button>
            {errorCount > 0 && (
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing} className="gap-2">
                <RefreshCw className="h-4 w-4" />Reprocessar
              </Button>
            )}
            <Button onClick={confirmImport} disabled={importing || validCount === 0} className="gap-2 min-w-[160px]">
              {importing ? (
                <><RefreshCw className="h-4 w-4 animate-spin" />Importando...</>
              ) : (
                <><Upload className="h-4 w-4" />Importar {validCount} linha{validCount !== 1 ? 's' : ''}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit/New Medication Dialog ── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMed ? 'Editar Medicamento' : 'Novo Medicamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Paracetamol 500mg" />
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
                <Label>Fabricante</Label>
                <Input value={editForm.manufacturer} onChange={(e) => setEditForm((p) => ({ ...p, manufacturer: e.target.value }))} placeholder="Ex: EMS" />
              </div>
              <div>
                <Label>Preço (R$) *</Label>
                <Input type="number" min={0} step={0.01} value={editForm.price} onChange={(e) => setEditForm((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Estoque (unidades)</Label>
                <Input type="number" min={0} value={editForm.stock} onChange={(e) => setEditForm((p) => ({ ...p, stock: parseInt(e.target.value) || 0 }))} />
              </div>
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
