import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Clock, Play, RefreshCw, AlertCircle, Users, Bell, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logEvent } from '@/lib/audit';
import type { IntakeData } from '@/lib/consultaDraft';

interface WaitingPatient {
  id: string;
  patient_name: string;
  created_at: string;
  number?: number | null;
  intake?: IntakeData | null;
}

// Prévia curta da queixa para triagem na fila (sem abrir o atendimento).
function complaintPreview(intake?: IntakeData | null): string | null {
  if (!intake) return null;
  if (intake.sintomaPrincipal?.trim()) return intake.sintomaPrincipal.trim();
  if (intake.sintomas?.length) return intake.sintomas.slice(0, 3).join(', ');
  if (intake.descricao?.trim()) {
    const d = intake.descricao.trim();
    return d.length > 80 ? `${d.slice(0, 80)}…` : d;
  }
  return null;
}

interface DoctorProfile {
  full_name: string;
  crm: string;
}

function elapsed(createdAt: string) {
  try {
    return formatDistanceToNow(new Date(createdAt), { locale: ptBR, addSuffix: false });
  } catch { return '—'; }
}

function getInitials(name: string) {
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function MedicoSalaEspera() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [queue, setQueue] = useState<WaitingPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('consultations')
      .select('id, patient_name, created_at, number, intake_data')
      .eq('status', 'waiting_doctor')
      .order('created_at', { ascending: true });
    const rows = (data ?? []) as unknown as (WaitingPatient & { intake_data?: IntakeData | null })[];
    setQueue(rows.map(r => ({
      id: r.id, patient_name: r.patient_name, created_at: r.created_at,
      number: r.number, intake: r.intake_data ?? null,
    })));
    setLoading(false);
  }, []);

  // Load doctor profile once for use when accepting a consultation.
  // The CRM lives in auth user_metadata (saved in Configurações › CRM/RQE),
  // not in the profiles table — read it here so accepted consultations carry
  // the real CRM (required for valid prescriptions/certificates).
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      const meta = (user.user_metadata ?? {}) as { doctor_crm?: string; full_name?: string };
      setDoctorProfile({
        full_name: data?.full_name ?? meta.full_name ?? 'Médico Novità',
        crm: meta.doctor_crm ?? '',
      });
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    load();

    // Real-time subscription — instant updates when patients join or leave
    const channel = supabase
      .channel('medico-sala-espera-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'consultations' },
        (payload) => {
          const p = payload.new as { id: string; patient_name: string; created_at: string; status: string; number?: number | null; intake_data?: IntakeData | null };
          // New consultations now enter as 'waiting_attendant' (triage), so they
          // only reach the doctor queue via the UPDATE handler below. Kept guarded
          // in case a row is ever inserted already routed.
          if (p.status !== 'waiting_doctor') return;
          setQueue(prev => {
            if (prev.some(x => x.id === p.id)) return prev;
            const next = [...prev, { id: p.id, patient_name: p.patient_name, created_at: p.created_at, number: p.number, intake: p.intake_data ?? null }];
            return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'consultations' },
        (payload) => {
          const p = payload.new as { id: string; patient_name: string; created_at: string; status: string; number?: number | null; intake_data?: IntakeData | null };
          if (p.status === 'waiting_doctor') {
            // Attendant just routed this patient — add to the doctor queue.
            setQueue(prev => {
              if (prev.some(x => x.id === p.id)) return prev;
              const next = [...prev, { id: p.id, patient_name: p.patient_name, created_at: p.created_at, number: p.number, intake: p.intake_data ?? null }];
              return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
          } else {
            // Accepted by a doctor / cancelled / sent back — drop from the queue.
            setQueue(prev => prev.filter(x => x.id !== p.id));
          }
        }
      )
      .subscribe();

    // Tick every 60s just to refresh elapsed time display
    const tickInterval = setInterval(() => setTick(t => t + 1), 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(tickInterval);
    };
  }, [load, toast]);

  const startConsultation = async (patientId: string) => {
    if (starting) return;

    // Read the doctor's identity fresh (avoids racing the async profile load)
    // and block acceptance when the CRM is missing — a consultation accepted
    // without a CRM would generate prescriptions/certificates with no legal validity.
    const { data: { user } } = await supabase.auth.getUser();
    const meta = (user?.user_metadata ?? {}) as { doctor_crm?: string; full_name?: string };
    const doctorCrm  = (meta.doctor_crm ?? doctorProfile?.crm ?? '').trim();
    const doctorName = doctorProfile?.full_name ?? meta.full_name ?? 'Médico Novità';

    if (!doctorCrm) {
      toast({
        title: 'Cadastre seu CRM antes de atender',
        description: 'O CRM é obrigatório para emitir receitas e atestados válidos. Conclua em Configurações › CRM/RQE.',
        variant: 'destructive',
      });
      navigate('/medico/configuracoes?tab=crm');
      return;
    }

    setStarting(patientId);
    try {
      const { error, data: updated } = await supabase
        .from('consultations')
        .update({
          status: 'in_consultation',
          doctor_id: user?.id,
          doctor_name: doctorName,
          doctor_crm: doctorCrm,
          consultation_started_at: new Date().toISOString(), // legal start of the medical act
          // NOTE: doctor_calling_at is intentionally NOT set here. The patient is
          // rung by MedicoAtendimento once its video panel has acquired the camera,
          // so the doctor's camera opens BEFORE the patient's — on a single shared
          // webcam (same machine) simultaneous acquisition makes one side go dark.
          updated_at: new Date().toISOString(),
        })
        .eq('id', patientId)
        .eq('status', 'waiting_doctor') // race-condition guard: only one doctor wins
        .select();

      if (error) throw error;
      if (!updated || updated.length === 0) {
        toast({ title: 'Paciente já foi atendido por outro médico.', variant: 'destructive' });
        setStarting(null);
        load(); // refresh queue
        return;
      }

      const queued = queue.find(x => x.id === patientId);
      logEvent('doctor_accepted_consultation', {
        consultationId: patientId,
        payload: {
          wait_time_s: queued ? Math.max(0, Math.round((Date.now() - new Date(queued.created_at).getTime()) / 1000)) : null,
          queue_size: queue.length,
        },
      });

      setQueue(prev => prev.filter(x => x.id !== patientId));
      // ?autostart=1 tells MedicoAtendimento to open the video panel immediately
      navigate(`/medico/atendimento/${patientId}?autostart=1`);
    } catch {
      toast({ title: 'Erro ao iniciar atendimento', variant: 'destructive' });
      setStarting(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Sala de Espera</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {queue.length > 0
              ? `${queue.length} paciente${queue.length > 1 ? 's' : ''} aguardando atendimento`
              : 'Nenhum paciente aguardando'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats bar */}
      {queue.length > 0 && (
        <div className="flex items-center gap-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <div className="flex items-center gap-2 text-amber-700">
            <Users className="h-4 w-4" />
            <span className="text-sm font-semibold">{queue.length} na fila</span>
          </div>
          <div className="flex items-center gap-2 text-amber-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Mais antigo: {elapsed(queue[0].created_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-green-600 ml-auto">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-xs font-medium">Tempo real</span>
          </div>
        </div>
      )}

      {/* Queue */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Carregando fila...</div>
      ) : queue.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Users className="h-7 w-7 text-green-500" />
            </div>
            <p className="font-semibold text-foreground mb-1">Sala de espera vazia</p>
            <p className="text-sm text-muted-foreground mb-4">
              Nenhum paciente aguardando no momento.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Você será notificado quando um paciente entrar
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map((patient, idx) => (
            <Card
              key={patient.id}
              className={`transition-shadow hover:shadow-md ${idx === 0 ? 'border-amber-200 bg-amber-50/40' : ''}`}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Position badge */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    idx === 0 ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {idx + 1}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {getInitials(patient.patient_name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{patient.patient_name}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Aguardando há {elapsed(patient.created_at)}
                      </span>
                      <span className="text-[11px] text-muted-foreground/60 font-mono">
                        #{patient.number ?? patient.id.slice(0, 8)}
                      </span>
                    </div>
                    {complaintPreview(patient.intake) && (
                      <p className="text-xs text-foreground/70 flex items-start gap-1 mt-1.5">
                        <Activity className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                        <span className="line-clamp-1">Queixa: {complaintPreview(patient.intake)}</span>
                      </p>
                    )}
                  </div>

                  {/* "Next" label for first patient */}
                  {idx === 0 && (
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-600 font-medium shrink-0">
                      <Bell className="h-3.5 w-3.5" />
                      Próximo
                    </div>
                  )}

                  {/* Action */}
                  <Button
                    size="sm"
                    className={`gap-1.5 shrink-0 ${idx === 0 ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
                    onClick={() => startConsultation(patient.id)}
                    disabled={!!starting}
                  >
                    {starting === patient.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    {idx === 0 ? 'Chamar Paciente' : 'Iniciar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order hint */}
      {queue.length > 1 && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-xl p-4 border border-border/50">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>Os pacientes são atendidos por ordem de chegada. O primeiro da fila é destacado em amarelo.</p>
        </div>
      )}
    </div>
  );
}
