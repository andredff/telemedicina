import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PenLine, Search, User, Calendar, FileText, FlaskConical, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Draft {
  medications?: { name: string }[];
  examRequests?: { name: string }[];
  certificate?: { days: string } | null;
  signed: boolean;
  signedAt: string | null;
  anamnese?: string;
}

interface Item {
  id: string;
  patient_name: string;
  date: string;
  doctor_name: string;
  doctor_crm: string;
  draft: Draft;
}

function loadDraft(id: string): Draft | null {
  try { const r = localStorage.getItem(`novita_draft_${id}`); return r ? JSON.parse(r) : null; } catch { return null; }
}

function fmt(d: string) { try { return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return d; } }
function fmtShort(d: string) { try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; } }

export default function MedicoDocumentos() {
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
      const signed = (data ?? [])
        .map(c => ({ ...c, draft: loadDraft(c.id) }))
        .filter((c): c is Item => !!c.draft && c.draft.signed === true);
      setItems(signed);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = items.filter(i =>
    !search.trim() || i.patient_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Documentos Assinados</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {items.length} documento{items.length !== 1 ? 's' : ''} assinado{items.length !== 1 ? 's' : ''} digitalmente
        </p>
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
            <PenLine className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
            <p className="font-medium text-foreground mb-1">
              {search ? 'Nenhum documento encontrado' : 'Nenhum documento assinado'}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Os documentos aparecem aqui após você usar a assinatura digital na aba "Assinatura" de um atendimento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <Card key={item.id} className="hover:shadow-sm transition-shadow border-primary/20 bg-primary/[0.02]">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{item.patient_name}</p>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/15">
                        <PenLine className="h-3 w-3" /> Assinado
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" /> {fmtShort(item.date)}
                    </p>

                    {item.draft.signedAt && (
                      <p className="text-xs text-primary/80 mt-0.5">
                        Assinado em {fmt(item.draft.signedAt)}
                      </p>
                    )}

                    {/* Document types in this consultation */}
                    <div className="flex gap-2 mt-2.5 flex-wrap">
                      {(item.draft.medications?.length ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-border text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          Receita ({item.draft.medications!.length})
                        </span>
                      )}
                      {(item.draft.examRequests?.length ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-border text-muted-foreground">
                          <FlaskConical className="h-3 w-3" />
                          Exames ({item.draft.examRequests!.length})
                        </span>
                      )}
                      {item.draft.certificate && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-border text-muted-foreground">
                          <ClipboardCheck className="h-3 w-3" />
                          Atestado
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground/60 mt-2 font-mono">#{item.id.slice(0, 8)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
