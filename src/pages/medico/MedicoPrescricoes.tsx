import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Search, Download, User, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  listPrescriptions, getSignedPrescriptionUrl, type PrescriptionRecord,
} from '@/services/prescriptionService';

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
}

function PrescricaoCard({ item }: { item: PrescriptionRecord }) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const patientName = item.consultations?.patient_name ?? 'Paciente';
  const date = item.consultations?.date ?? item.created_at;
  const meds = item.medications ?? [];
  const isSigned = item.status === 'signed';

  const handleDownload = async () => {
    if (!item.pdf_path) return;
    setDownloading(true);
    try {
      const url = await getSignedPrescriptionUrl(item.pdf_path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{patientName}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="h-3 w-3" />{fmt(date)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {meds.length} medicamento{meds.length !== 1 ? 's' : ''}
                {isSigned && <span className="ml-2 text-primary font-medium">· Assinada</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item.pdf_path && (
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading} className="gap-1.5 h-8">
                <Download className="h-3.5 w-3.5" /> {downloading ? 'Abrindo...' : 'Baixar PDF'}
              </Button>
            )}
            <button onClick={() => setOpen(v => !v)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            {meds.map((m, i) => (
              <div key={i} className="flex gap-2 text-sm bg-gray-50 rounded-lg p-3">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <div>
                  <p className="font-medium text-foreground">{m.name}</p>
                  {m.dosage && <p className="text-xs text-muted-foreground mt-0.5">{m.dosage}{m.quantity ? ` · ${m.quantity}` : ''}</p>}
                  {m.instructions && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{m.instructions}</p>}
                </div>
              </div>
            ))}
            {item.guidance?.trim() && (
              <div className="text-sm bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Orientações médicas</p>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{item.guidance}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MedicoPrescricoes() {
  const [items, setItems] = useState<PrescriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setItems(await listPrescriptions());
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = items.filter(i => {
    const name = i.consultations?.patient_name ?? '';
    return !search.trim() || name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Prescrições</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{items.length} receita{items.length !== 1 ? 's' : ''} emitida{items.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por paciente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
            <p className="font-medium text-foreground mb-1">{search ? 'Nenhuma receita encontrada' : 'Nenhuma receita emitida'}</p>
            <p className="text-sm text-muted-foreground">As receitas aparecem após assinar uma receita durante o atendimento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">{filtered.map(item => <PrescricaoCard key={item.id} item={item} />)}</div>
      )}
    </div>
  );
}
