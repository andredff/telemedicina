import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CheckCircle, User, Search, FileText, FlaskConical,
  ClipboardCheck, PenLine, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConsultationDraft {
  anamnese: string;
  medications: { id: string; name: string; dosage: string; quantity: string; instructions: string }[];
  examRequests: { id: string; name: string; justification: string; priority: string }[];
  certificate: { days: string; startDate: string; cidCode: string; reason: string } | null;
  signed: boolean;
  signedAt: string | null;
}

interface Consultation {
  id: string;
  patient_name: string;
  date: string;
  doctor_name: string;
  doctor_crm: string;
  number?: number | null;
  clinical_data?: ConsultationDraft | null;
}

// O prontuário fica em consultations.clinical_data (banco) — fonte única que
// aparece em qualquer dispositivo/médico. localStorage é apenas fallback de
// rascunhos antigos criados na própria máquina, antes desta migração.
function loadLocalDraft(id: string): ConsultationDraft | null {
  try {
    const raw = localStorage.getItem(`novita_draft_${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function consultationDraft(c: Consultation): ConsultationDraft | null {
  return c.clinical_data ?? loadLocalDraft(c.id);
}

function formatDate(d: string) {
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
}

function DocBadge({ label, icon: Icon, count }: { label: string; icon: React.ElementType; count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
      <Icon className="h-3 w-3" />
      {label}{count > 1 ? ` (${count})` : ''}
    </span>
  );
}

function HistoricoCard({ c }: { c: Consultation }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const draft = consultationDraft(c);

  const hasDocs = draft && (
    draft.medications.length > 0 ||
    draft.examRequests.length > 0 ||
    draft.certificate !== null
  );

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-5">
        {/* Summary row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm">{c.patient_name}</p>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(c.date)}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">#{c.number ?? c.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
              <CheckCircle className="h-3 w-3" /> Concluída
            </span>

            {draft?.signed && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                <PenLine className="h-3 w-3" /> Assinado
              </span>
            )}

            {hasDocs && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={() => setExpanded(v => !v)}
              >
                Documentos
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => navigate(`/medico/atendimento/${c.id}`)}
            >
              <FileText className="h-3 w-3" /> Abrir
            </Button>
          </div>
        </div>

        {/* Document tags (collapsed) */}
        {!expanded && draft && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <DocBadge label="Medicamentos" icon={FileText} count={draft.medications.length} />
            <DocBadge label="Exame" icon={FlaskConical} count={draft.examRequests.length} />
            <DocBadge label="Atestado" icon={ClipboardCheck} count={draft.certificate ? 1 : 0} />
          </div>
        )}

        {/* Expanded documents */}
        {expanded && draft && (
          <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
            {/* Anamnese */}
            {draft.anamnese && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Anamnese</p>
                <p className="text-sm text-foreground bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{draft.anamnese}</p>
              </div>
            )}

            {/* Medications */}
            {draft.medications.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Receita Médica ({draft.medications.length} medicamento{draft.medications.length > 1 ? 's' : ''})
                </p>
                <div className="space-y-2">
                  {draft.medications.map((m, i) => (
                    <div key={m.id} className="flex gap-2 text-sm bg-gray-50 rounded-lg p-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{m.name}</p>
                        {m.dosage && <p className="text-xs text-muted-foreground mt-0.5">{m.dosage}{m.quantity ? ` · ${m.quantity}` : ''}</p>}
                        {m.instructions && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{m.instructions}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exam requests */}
            {draft.examRequests.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Exames Solicitados ({draft.examRequests.length})
                </p>
                <div className="space-y-2">
                  {draft.examRequests.map((e) => (
                    <div key={e.id} className="flex items-start gap-2 text-sm bg-violet-50 rounded-lg p-3 border border-violet-100">
                      <FlaskConical className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">{e.name}</p>
                        {e.justification && <p className="text-xs text-muted-foreground mt-0.5">{e.justification}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certificate */}
            {draft.certificate && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Atestado Médico</p>
                <div className="bg-teal-50 rounded-lg p-3 border border-teal-100 text-sm">
                  <p className="font-medium text-teal-800">
                    {draft.certificate.days} dia{Number(draft.certificate.days) > 1 ? 's' : ''} de afastamento
                    — a partir de {formatDate(draft.certificate.startDate)}
                  </p>
                  {draft.certificate.cidCode && (
                    <p className="text-xs text-teal-600 mt-1">CID-10: {draft.certificate.cidCode}</p>
                  )}
                  <p className="text-xs text-teal-700 mt-1">{draft.certificate.reason}</p>
                </div>
              </div>
            )}

            {/* Signature */}
            {draft.signed && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <PenLine className="h-3.5 w-3.5" />
                Assinado digitalmente por {c.doctor_name} · {c.doctor_crm}
                {draft.signedAt && (
                  <span className="text-muted-foreground">
                    em {format(new Date(draft.signedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MedicoHistorico() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('consultations')
          .select('id, patient_name, date, doctor_name, doctor_crm, number, clinical_data')
          .eq('status', 'completed')
          .order('updated_at', { ascending: false });
        setConsultations((data ?? []) as unknown as Consultation[]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = consultations.filter(c =>
    !search.trim() ||
    c.patient_name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Histórico de Atendimentos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {consultations.length} atendimento{consultations.length !== 1 ? 's' : ''} concluído{consultations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por paciente ou ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando histórico...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground mb-1">
              {search ? 'Nenhum atendimento encontrado' : 'Nenhum atendimento concluído'}
            </p>
            <p className="text-sm text-muted-foreground">
              {search
                ? 'Tente um termo diferente.'
                : 'Os atendimentos finalizados aparecerão aqui.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <HistoricoCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
