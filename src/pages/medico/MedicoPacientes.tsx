import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, User, ChevronRight, ArrowLeft, Clock, CheckCircle,
  Video, Calendar, FileText, FlaskConical, ClipboardCheck, Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Consultation {
  id: string;
  patient_name: string;
  date: string;
  status: string;
  doctor_name: string;
}

interface Patient {
  name: string;
  consultations: Consultation[];
  lastDate: string;
}

interface ConsultationDraft {
  anamnese?: string;
  medications?: unknown[];
  examRequests?: unknown[];
  certificate?: unknown;
  signed?: boolean;
}

type DetailTab = 'historico' | 'prontuario' | 'anexos';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadDraft(id: string): ConsultationDraft | null {
  try { const r = localStorage.getItem(`novita_draft_${id}`); return r ? JSON.parse(r) : null; } catch { return null; }
}

function fmt(d: string) {
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
}

function getInitials(name: string) {
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function statusBadge(status: string) {
  switch (status) {
    case 'pending': return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Aguardando</span>;
    case 'in_progress': return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Em andamento</span>;
    case 'completed': return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Concluída</span>;
    case 'cancelled': return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Cancelada</span>;
    default: return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{status}</span>;
  }
}

// ─── Patient Detail ───────────────────────────────────────────────────────────

function PatientDetail({ patient, onBack }: { patient: Patient; onBack: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as DetailTab) || 'historico';
  const setTab = (t: DetailTab) => setSearchParams(t === 'historico' ? {} : { tab: t });

  const navigate = useNavigate();

  const consultations = patient.consultations;
  const totalDocs = consultations.reduce((acc, c) => {
    const d = loadDraft(c.id);
    return acc + (d?.medications?.length ?? 0) + (d?.examRequests?.length ?? 0) + (d?.certificate ? 1 : 0);
  }, 0);

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>

      {/* Patient card */}
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
            {getInitials(patient.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground">{patient.name}</h2>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {consultations.length} consulta{consultations.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {totalDocs} documento{totalDocs !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted-foreground">Última: {fmt(patient.lastDate)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 border border-border/40">
        {([
          { id: 'historico' as DetailTab, label: 'Histórico' },
          { id: 'prontuario' as DetailTab, label: 'Prontuário' },
          { id: 'anexos' as DetailTab, label: 'Anexos' },
        ]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-white text-foreground shadow-sm border border-border/40' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'historico' && (
        <div className="space-y-3">
          {consultations.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma consulta registrada.</CardContent></Card>
          ) : consultations.map(c => {
            const draft = loadDraft(c.id);
            return (
              <Card key={c.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(c.status)}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />{fmt(c.date)}
                        </span>
                        <span className="text-[11px] text-muted-foreground/60 font-mono">#{c.id.slice(0, 8)}</span>
                      </div>
                      {draft && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {(draft.medications?.length ?? 0) > 0 && (
                            <span className="text-[10px] flex items-center gap-1 text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              <FileText className="h-3 w-3" /> {draft.medications!.length} medicamento{draft.medications!.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {(draft.examRequests?.length ?? 0) > 0 && (
                            <span className="text-[10px] flex items-center gap-1 text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              <FlaskConical className="h-3 w-3" /> {draft.examRequests!.length} exame{draft.examRequests!.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {draft.certificate && (
                            <span className="text-[10px] flex items-center gap-1 text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              <ClipboardCheck className="h-3 w-3" /> Atestado
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {c.status === 'in_progress' && (
                      <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                        onClick={() => navigate(`/medico/atendimento/${c.id}`)}>
                        <Video className="h-3.5 w-3.5" /> Continuar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'prontuario' && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">Prontuário eletrônico</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              O prontuário eletrônico integrado estará disponível em breve.
            </p>
            <Badge variant="secondary" className="mt-3">Em breve</Badge>
          </CardContent>
        </Card>
      )}

      {tab === 'anexos' && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">Anexos do paciente</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Envio e visualização de exames, laudos e documentos em breve.
            </p>
            <Badge variant="secondary" className="mt-3">Em breve</Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MedicoPacientes() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Patient | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('consultations')
          .select('id, patient_name, date, status, doctor_name')
          .order('created_at', { ascending: false });

        // Deduplicate by patient_name
        const map = new Map<string, Patient>();
        for (const c of data ?? []) {
          const key = c.patient_name;
          if (!map.has(key)) {
            map.set(key, { name: key, consultations: [], lastDate: c.date });
          }
          const p = map.get(key)!;
          p.consultations.push(c);
          if (c.date > p.lastDate) p.lastDate = c.date;
        }
        setPatients(Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate)));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = patients.filter(p =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <PatientDetail patient={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Pacientes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{patients.length} paciente{patients.length !== 1 ? 's' : ''} no histórico</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando pacientes...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <User className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground mb-1">{search ? 'Nenhum paciente encontrado' : 'Nenhum paciente ainda'}</p>
            <p className="text-sm text-muted-foreground">Os pacientes aparecerão após o primeiro atendimento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <button
              key={p.name}
              onClick={() => setSelected(p)}
              className="w-full text-left"
            >
              <Card className="hover:shadow-md hover:border-primary/20 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {getInitials(p.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{p.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {p.consultations.length} consulta{p.consultations.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-muted-foreground">Última: {fmt(p.lastDate)}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
