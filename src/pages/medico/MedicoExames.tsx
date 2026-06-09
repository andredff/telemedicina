import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FlaskConical, Search, Printer, User, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExamRequest { id: string; name: string; justification: string; priority: string }
interface Draft { examRequests: ExamRequest[]; signed: boolean; signedAt: string | null }
interface Item { id: string; patient_name: string; date: string; doctor_name: string; doctor_crm: string; draft: Draft }

function loadDraft(id: string): Draft | null {
  try { const r = localStorage.getItem(`novita_draft_${id}`); return r ? JSON.parse(r) : null; } catch { return null; }
}
function fmt(d: string) { try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; } }

const PRIORITY_LABEL: Record<string, string> = { urgente: 'Urgente', alta: 'Alta', normal: 'Normal', baixa: 'Baixa', '': 'Normal' };
const PRIORITY_COLOR: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700', alta: 'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700', baixa: 'bg-gray-100 text-gray-600', '': 'bg-blue-100 text-blue-700',
};

function printExames(item: Item) {
  const exams = item.draft.examRequests.map((e, i) => `
    <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #eee">
      <b>${i + 1}. ${e.name}</b>${e.priority ? ` <span style="color:#666">[${PRIORITY_LABEL[e.priority] || e.priority}]</span>` : ''}<br/>
      ${e.justification ? `<span style="color:#666;font-size:13px">${e.justification}</span>` : ''}
    </div>`).join('');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>Pedido de Exames</title><style>body{font-family:serif;max-width:600px;margin:40px auto;color:#111}h2{text-align:center;font-size:20px;border-bottom:2px solid #333;padding-bottom:8px}p{font-size:13px;color:#555}</style></head><body>
    <h2>PEDIDO DE EXAMES</h2>
    <p><b>Paciente:</b> ${item.patient_name}</p>
    <p><b>Data:</b> ${fmt(item.date)}</p>
    <p><b>Médico:</b> ${item.doctor_name} · ${item.doctor_crm}</p>
    <hr style="margin:16px 0"/>
    ${exams}
    ${item.draft.signed ? `<p style="margin-top:32px;font-size:12px;color:#888">Assinado digitalmente em ${item.draft.signedAt ? fmt(item.draft.signedAt) : '—'}</p>` : ''}
  </body></html>`);
  w.document.close();
  w.print();
}

function ExameCard({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <FlaskConical className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{item.patient_name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="h-3 w-3" />{fmt(item.date)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.draft.examRequests.length} exame{item.draft.examRequests.length !== 1 ? 's' : ''}
                {item.draft.signed && <span className="ml-2 text-primary font-medium">· Assinado</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => printExames(item)} className="gap-1.5 h-8">
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
            <button onClick={() => setOpen(v => !v)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            {item.draft.examRequests.map(e => (
              <div key={e.id} className="flex items-start gap-2 text-sm bg-violet-50 rounded-lg p-3 border border-violet-100">
                <FlaskConical className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">{e.name}</p>
                    {e.priority && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_COLOR[e.priority] || PRIORITY_COLOR['']}`}>
                        {PRIORITY_LABEL[e.priority] || e.priority}
                      </span>
                    )}
                  </div>
                  {e.justification && <p className="text-xs text-muted-foreground mt-0.5">{e.justification}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MedicoExames() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('consultations')
        .select('id, patient_name, date, doctor_name, doctor_crm')
        .eq('status', 'completed')
        .order('updated_at', { ascending: false });
      const withDraft = (data ?? [])
        .map(c => ({ ...c, draft: loadDraft(c.id) }))
        .filter((c): c is Item => !!c.draft && (c.draft.examRequests?.length ?? 0) > 0);
      setItems(withDraft);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = items.filter(i => !search.trim() || i.patient_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Exames</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{items.length} solicitação{items.length !== 1 ? 'ões' : ''} de exame</p>
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
            <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
            <p className="font-medium text-foreground mb-1">{search ? 'Nenhum exame encontrado' : 'Nenhuma solicitação de exame'}</p>
            <p className="text-sm text-muted-foreground">As solicitações aparecem após finalizar um atendimento com pedido de exames.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">{filtered.map(item => <ExameCard key={item.id} item={item} />)}</div>
      )}
    </div>
  );
}
