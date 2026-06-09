import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Clock, Play, RefreshCw, AlertCircle, Users, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { playNotificationSound } from '@/lib/sound';

interface WaitingPatient {
  id: string;
  patient_name: string;
  created_at: string;
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
  const alertedIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('consultations')
      .select('id, patient_name, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setQueue(data ?? []);
    setLoading(false);
  }, []);

  // Load doctor profile once for use when accepting a consultation
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (data) {
        setDoctorProfile({ full_name: data.full_name ?? 'Médico Novità', crm: '' });
      }
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
          const p = payload.new as { id: string; patient_name: string; created_at: string; status: string };
          if (p.status !== 'pending') return;
          setQueue(prev => {
            if (prev.some(x => x.id === p.id)) return prev;
            const next = [...prev, { id: p.id, patient_name: p.patient_name, created_at: p.created_at }];
            return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
          if (!alertedIds.current.has(p.id)) {
            alertedIds.current.add(p.id);
            playNotificationSound();
            toast({
              title: 'Novo paciente na fila',
              description: `${p.patient_name} está aguardando atendimento.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'consultations' },
        (payload) => {
          const p = payload.new as { id: string; status: string };
          // Remove from queue when status changes away from 'pending'
          if (p.status !== 'pending') {
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
    setStarting(patientId);
    try {
      const doctorName = doctorProfile?.full_name ?? 'Médico Novità';
      const doctorCrm  = doctorProfile?.crm ?? '';

      const { error, data: updated } = await supabase
        .from('consultations')
        .update({
          status: 'in_progress',
          doctor_name: doctorName,
          doctor_crm: doctorCrm,
          updated_at: new Date().toISOString(),
        })
        .eq('id', patientId)
        .eq('status', 'pending') // race-condition guard: only accept if still pending
        .select();

      if (error) throw error;
      if (!updated || updated.length === 0) {
        toast({ title: 'Paciente já foi atendido por outro médico.', variant: 'destructive' });
        setStarting(null);
        load(); // refresh queue
        return;
      }

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
                        #{patient.id.slice(0, 8)}
                      </span>
                    </div>
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
