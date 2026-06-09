import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClipboardCheck, Search, Printer, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Certificate { days: string; startDate: string; cidCode: string; reason: string }
interface Draft { certificate: Certificate | null; signed: boolean; signedAt: string | null }
interface Item { id: string; patient_name: string; date: string; doctor_name: string; doctor_crm: string; draft: Draft }

function loadDraft(id: string): Draft | null {
  try { const r = localStorage.getItem(`novita_draft_${id}`); return r ? JSON.parse(r) : null; } catch { return null; }
}
function fmt(d: string) { try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; } }

function printAtestado(item: Item) {
  const cert = item.draft.certificate!;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>Atestado Médico</title><style>body{font-family:serif;max-width:600px;margin:40px auto;color:#111;line-height:1.6}h2{text-align:center;font-size:20px;border-bottom:2px solid #333;padding-bottom:8px}p{font-size:14px}</style></head><body>
    <h2>ATESTADO MÉDICO</h2>
    <p>Atesto para os devidos fins que o(a) paciente <b>${item.patient_name}</b> esteve sob meus cuidados médicos,
    necessitando de <b>${cert.days} dia${Number(cert.days) > 1 ? 's' : ''} de afastamento</b> de suas atividades,
    a partir de ${fmt(cert.startDate)}.</p>
    ${cert.cidCode ? `<p>CID-10: ${cert.cidCode}</p>` : ''}
    ${cert.reason ? `<p>Motivo: ${cert.reason}</p>` : ''}
    <br/><br/>
    <p>Data: ${fmt(item.date)}</p>
    <p>${item.doctor_name}</p>
    <p>${item.doctor_crm}</p>
    ${item.draft.signed ? `<p style="margin-top:32px;font-size:12px;color:#888">Assinado digitalmente em ${item.draft.signedAt ? fmt(item.draft.signedAt) : '—'}</p>` : ''}
  </body></html>`);
  w.document.close();
  w.print();
}

export default function MedicoAtestados() {
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
        .filter((c): c is Item => !!c.draft && !!c.draft.certificate);
      setItems(withDraft);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = items.filter(i => !search.trim() || i.patient_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Atestados</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{items.length} atestado{items.length !== 1 ? 's' : ''} emitido{items.length !== 1 ? 's' : ''}</p>
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
            <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
            <p className="font-medium text-foreground mb-1">{search ? 'Nenhum atestado encontrado' : 'Nenhum atestado emitido'}</p>
            <p className="text-sm text-muted-foreground">Os atestados aparecem após finalizar um atendimento com emissão de atestado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const cert = item.draft.certificate!;
            return (
              <Card key={item.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                        <ClipboardCheck className="h-5 w-5 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{item.patient_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />{fmt(item.date)}
                        </p>
                        <p className="text-xs text-teal-700 mt-0.5 font-medium">
                          {cert.days} dia{Number(cert.days) > 1 ? 's' : ''} de afastamento
                          {cert.startDate ? ` — a partir de ${fmt(cert.startDate)}` : ''}
                        </p>
                        {cert.cidCode && <p className="text-xs text-muted-foreground mt-0.5">CID-10: {cert.cidCode}</p>}
                        {item.draft.signed && <span className="text-xs text-primary font-medium">· Assinado digitalmente</span>}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => printAtestado(item)} className="gap-1.5 h-8 shrink-0">
                      <Printer className="h-3.5 w-3.5" /> Imprimir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
