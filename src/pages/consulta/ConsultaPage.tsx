import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSignaling } from '@/hooks/useSignaling';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Loader2, Clock, CheckCircle, AlertCircle, User,
  MessageSquare, Info, Send, X, Stethoscope, ShieldCheck,
  SignalHigh, SignalMedium, SignalLow, PhoneCall,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createRingtone } from '@/lib/sound';

type CallState = 'setup' | 'waiting' | 'connecting' | 'in_call' | 'ended' | 'error';
type Quality = 'good' | 'fair' | 'poor';
type SidePanel = 'info' | 'chat' | null;

interface ChatMessage {
  id: string;
  from: 'patient' | 'doctor';
  text: string;
  at: number;
}

export default function ConsultaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [callState, setCallState] = useState<CallState>('setup');
  const [doctorName, setDoctorName] = useState('Médico');
  const [doctorCrm, setDoctorCrm] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [remoteAudio, setRemoteAudio] = useState(true);
  const [remoteVideo, setRemoteVideo] = useState(true);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [cancellingConsulta, setCancellingConsulta] = useState(false);
  const [doctorCalling, setDoctorCalling] = useState(false); // doctor re-ringing after call ended
  const lastCallingRef = useRef<string | null>(null);
  const ringtoneRef = useRef(createRingtone());

  // Side panel + chat + quality
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [quality, setQuality] = useState<Quality>('good');
  const sidePanelRef = useRef<SidePanel>(null);
  sidePanelRef.current = sidePanel;
  const callStateRef = useRef<CallState>(callState);
  callStateRef.current = callState;

  // Two separate video refs for waiting-state PiP vs in-call PiP
  const localVideoWaitRef = useRef<HTMLVideoElement>(null);
  const localVideoPipRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Tracks to re-attach stream when ref mounts
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const waitingSince = useRef(new Date());
  const signaling = useSignaling(id ?? '');
  // Stable ref for signaling to avoid stale closure in callbacks
  const signalingRef = useRef(signaling);
  signalingRef.current = signaling;

  const webrtc = useWebRTC({
    onRemoteStream: useCallback((stream: MediaStream) => {
      setRemoteStream(stream);
      setCallState('in_call');
      setConnectedAt(new Date());
    }, []),
    onConnectionStateChange: useCallback((state: RTCPeerConnectionState) => {
      if (state === 'disconnected') {
        setQuality('poor');
        toast({ title: 'Conexão instável', description: 'Tentando reconectar...' });
      }
      if (state === 'failed' || state === 'closed') {
        setCallState(prev => prev === 'in_call' ? 'ended' : prev);
      }
    }, [toast]),
    onIceCandidate: useCallback((candidate: RTCIceCandidateInit) => {
      signalingRef.current.send('ice-candidate', candidate as Record<string, unknown>);
    }, []),
  });

  // Sync streams to video elements when either the stream or the element becomes available
  useEffect(() => {
    if (!localStream) return;
    if (localVideoWaitRef.current) localVideoWaitRef.current.srcObject = localStream;
    if (localVideoPipRef.current) localVideoPipRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream || !remoteVideoRef.current) return;
    remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Initial setup: acquire media + subscribe signaling + send patient-ready
  useEffect(() => {
    if (!id) return;
    let mounted = true;

    const setup = async () => {
      try {
        const { data } = await supabase
          .from('consultations')
          .select('doctor_name, doctor_crm, doctor_calling_at')
          .eq('id', id)
          .single();
        if (mounted && data?.doctor_name) setDoctorName(data.doctor_name);
        if (mounted && data?.doctor_crm) setDoctorCrm(data.doctor_crm);
        lastCallingRef.current = (data as { doctor_calling_at?: string | null } | null)?.doctor_calling_at ?? null;

        const stream = await webrtc.startMedia();
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

        setLocalStream(stream);
        webrtc.createPeerConnection();

        // Track presence + signal readiness
        signaling.track({ role: 'patient', consultation_id: id });
        signaling.send('patient-ready', { consultation_id: id });

        setCallState('waiting');
        waitingSince.current = new Date();
      } catch {
        if (!mounted) return;
        toast({
          title: 'Não foi possível acessar a câmera',
          description: 'Verifique as permissões do navegador e tente novamente.',
          variant: 'destructive',
        });
        setCallState('error');
      }
    };

    setup();
    return () => { mounted = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register signaling handlers (runs once)
  useEffect(() => {
    signaling.on('call-offer', async (payload) => {
      setCallState('connecting');
      try {
        const answer = await webrtc.createAnswer(payload as RTCSessionDescriptionInit);
        signalingRef.current.send('call-answer', answer as Record<string, unknown>);
      } catch {
        toast({ title: 'Erro ao conectar', description: 'Falha na negociação da chamada.', variant: 'destructive' });
        setCallState('error');
      }
    });

    signaling.on('ice-candidate', async (payload) => {
      await webrtc.addIceCandidate(payload as RTCIceCandidateInit);
    });

    signaling.on('call-ended', () => {
      webrtc.closeConnection();
      setCallState('ended');
    });

    signaling.on('media-state', (payload) => {
      if (typeof payload.audio === 'boolean') setRemoteAudio(payload.audio);
      if (typeof payload.video === 'boolean') setRemoteVideo(payload.video);
    });

    signaling.on('chat-message', (payload) => {
      const text = typeof payload.text === 'string' ? payload.text : '';
      if (!text) return;
      const msg: ChatMessage = {
        id: typeof payload.id === 'string' ? payload.id : crypto.randomUUID(),
        from: 'doctor',
        text,
        at: typeof payload.at === 'number' ? payload.at : Date.now(),
      };
      setMessages(prev => [...prev, msg]);
      if (sidePanelRef.current !== 'chat') setUnread(u => u + 1);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for doctor accepting the consultation (updates doctor name & signals readiness)
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`consulta-status-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'consultations', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as {
            status: string; doctor_name?: string; doctor_crm?: string; doctor_calling_at?: string | null;
          };
          if (updated.status === 'in_progress' && updated.doctor_name) {
            setDoctorName(updated.doctor_name);
            if (updated.doctor_crm) setDoctorCrm(updated.doctor_crm);
          }
          // Doctor re-opened the video after the call dropped/ended → offer to rejoin
          if (updated.doctor_calling_at && updated.doctor_calling_at !== lastCallingRef.current) {
            lastCallingRef.current = updated.doctor_calling_at;
            if (callStateRef.current === 'ended' || callStateRef.current === 'error') {
              setDoctorCalling(true);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Ring (audio) when the doctor is calling to rejoin
  useEffect(() => {
    const ringtone = ringtoneRef.current;
    if (doctorCalling && (callState === 'ended' || callState === 'error')) ringtone.start();
    else ringtone.stop();
    return () => ringtone.stop();
  }, [doctorCalling, callState]);

  // Tick every 30s to update elapsed time display (waiting room)
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Live duration ticker (every second while in call)
  useEffect(() => {
    if (callState !== 'in_call') return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [callState]);

  // Connection quality polling via WebRTC stats
  useEffect(() => {
    if (callState !== 'in_call') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const stats = await webrtc.getStats();
        if (!stats || cancelled) return;
        let rtt = 0, received = 0, lost = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stats.forEach((r: any) => {
          if (r.type === 'candidate-pair' && r.nominated && typeof r.currentRoundTripTime === 'number') {
            rtt = r.currentRoundTripTime;
          }
          if (r.type === 'inbound-rtp' && (r.kind === 'video' || r.mediaType === 'video')) {
            received = r.packetsReceived ?? 0;
            lost = r.packetsLost ?? 0;
          }
        });
        const lossRatio = received + lost > 0 ? lost / (received + lost) : 0;
        let q: Quality = 'good';
        if (rtt > 0.3 || lossRatio > 0.05) q = 'fair';
        if (rtt > 0.6 || lossRatio > 0.12) q = 'poor';
        if (!cancelled) setQuality(q);
      } catch { /* ignore */ }
    };
    const t = setInterval(poll, 3000);
    poll();
    return () => { cancelled = true; clearInterval(t); };
  }, [callState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => webrtc.closeConnection(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    webrtc.toggleAudio(next);
    signaling.send('media-state', { audio: next, video: videoEnabled });
  };

  const handleToggleVideo = () => {
    const next = !videoEnabled;
    setVideoEnabled(next);
    webrtc.toggleVideo(next);
    signaling.send('media-state', { audio: audioEnabled, video: next });
  };

  const handleCancelWaiting = async () => {
    if (!id || cancellingConsulta) return;
    setCancellingConsulta(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('consultations')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id);

        // Restore avulso credit if one was used for this consultation
        await (supabase as any)
          .from('consultation_credits')
          .update({ status: 'available', consultation_id: null, used_at: null })
          .eq('consultation_id', id)
          .eq('status', 'used');
      }
    } catch {
      // Silently ignore — navigation happens regardless
    } finally {
      webrtc.closeConnection();
      navigate('/teleconsultas');
    }
  };

  const handleEndCall = () => {
    signaling.send('call-ended', { initiated_by: 'patient' });
    webrtc.closeConnection();
    setCallState('ended');
  };

  const openPanel = (tab: 'info' | 'chat') => {
    setSidePanel(tab);
    if (tab === 'chat') setUnread(0);
  };

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    const msg: ChatMessage = { id: crypto.randomUUID(), from: 'patient', text, at: Date.now() };
    setMessages(prev => [...prev, msg]);
    signaling.send('chat-message', { id: msg.id, text: msg.text, at: msg.at });
    setChatInput('');
  };

  // ─── Doctor calling again (rejoin after a dropped/ended call) ──────────────────
  if ((callState === 'ended' || callState === 'error') && doctorCalling) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-xs">
          <span className="relative flex h-20 w-20 mx-auto">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex h-20 w-20 rounded-full bg-green-500 items-center justify-center">
              <PhoneCall className="h-9 w-9 text-white" />
            </span>
          </span>
          <div>
            <h1 className="text-xl font-bold text-white">{doctorName} está chamando</h1>
            <p className="text-sm text-white/60 mt-1.5">
              O médico quer retomar a consulta. Reentre na chamada para continuar o atendimento.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => window.location.reload()}
            >
              <Video className="h-5 w-5" /> Reentrar na chamada
            </Button>
            <Button
              variant="ghost"
              className="w-full text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => navigate('/teleconsultas')}
            >
              Agora não
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Ended ────────────────────────────────────────────────────────────────────
  if (callState === 'ended') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Consulta encerrada</h1>
          {connectedAt && (
            <p className="text-sm text-muted-foreground">
              Duração: {formatDistanceToNow(connectedAt, { locale: ptBR })}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Seus documentos médicos estarão disponíveis em breve no painel.
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={() => navigate('/prescriptions')}>
              Ver Prescrições
            </Button>
            <Button onClick={() => navigate('/dashboard')}>
              Ir para o Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────────
  if (callState === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Não foi possível conectar</h1>
          <p className="text-sm text-muted-foreground">
            Verifique câmera e microfone e tente novamente.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate(`/consulta/${id}/preparacao`)}>
              Tentar novamente
            </Button>
            <Button onClick={() => navigate('/dashboard')}>Voltar ao Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── In call ─────────────────────────────────────────────────────────────────
  if (callState === 'in_call') {
    const durationLabel = formatDuration(connectedAt, now);
    return (
      <div className="h-screen bg-slate-900 flex overflow-hidden">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/90 backdrop-blur border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Stethoscope className="h-4 w-4 text-primary/80" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{doctorName}</p>
                <p className="text-[11px] text-white/50 leading-tight truncate">
                  Clínico Geral{doctorCrm ? ` · ${doctorCrm}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/50">
                <ShieldCheck className="h-3.5 w-3.5 text-green-400/70" /> Criptografada
              </span>
              <QualityIndicator quality={quality} />
              <span className="flex items-center gap-1.5 bg-red-500/15 text-red-300 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {durationLabel}
              </span>
            </div>
          </header>

          {/* Video stage */}
          <div className="flex-1 relative bg-slate-950 min-h-0">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {!remoteVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
                <div className="w-24 h-24 rounded-full bg-primary/15 flex items-center justify-center">
                  <User className="h-12 w-12 text-primary/50" />
                </div>
                <p className="text-sm text-white/40">{doctorName} está com a câmera desligada</p>
              </div>
            )}

            {!remoteAudio && (
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs text-white">
                <MicOff className="h-3.5 w-3.5 text-red-400" /> Médico sem áudio
              </div>
            )}

            {/* Self PiP */}
            <div className="absolute bottom-4 right-4 w-28 h-40 sm:w-44 sm:h-28 rounded-2xl overflow-hidden border-2 border-white/15 shadow-2xl bg-slate-800">
              <video
                ref={localVideoPipRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!videoEnabled && (
                <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                  <VideoOff className="h-6 w-6 text-white/40" />
                </div>
              )}
              <div className="absolute bottom-1.5 left-1.5 bg-black/50 rounded px-1.5 py-0.5 text-[10px] text-white/80">
                Você
              </div>
            </div>
          </div>

          {/* Control bar */}
          <footer className="bg-slate-900 px-4 py-3.5 flex items-center justify-center gap-3 sm:gap-4 border-t border-white/5 shrink-0">
            <ControlButton
              active={audioEnabled}
              activeIcon={Mic}
              inactiveIcon={MicOff}
              onClick={handleToggleAudio}
              label={audioEnabled ? 'Mudo' : 'Ativar áudio'}
            />
            <ControlButton
              active={videoEnabled}
              activeIcon={Video}
              inactiveIcon={VideoOff}
              onClick={handleToggleVideo}
              label={videoEnabled ? 'Ocultar câmera' : 'Ativar câmera'}
            />
            <ToggleButton
              icon={MessageSquare}
              active={sidePanel === 'chat'}
              badge={sidePanel === 'chat' ? 0 : unread}
              onClick={() => (sidePanel === 'chat' ? setSidePanel(null) : openPanel('chat'))}
              label="Chat"
            />
            <ToggleButton
              icon={Info}
              active={sidePanel === 'info'}
              onClick={() => (sidePanel === 'info' ? setSidePanel(null) : openPanel('info'))}
              label="Detalhes"
            />
            <button
              onClick={handleEndCall}
              title="Encerrar chamada"
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg"
            >
              <PhoneOff className="h-6 w-6 text-white" />
            </button>
          </footer>
        </div>

        {/* ── Side panel ──────────────────────────────────────────────── */}
        {sidePanel && (
          <>
            {/* Mobile backdrop */}
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-10"
              onClick={() => setSidePanel(null)}
            />
            <aside className="fixed md:static inset-y-0 right-0 z-20 w-full sm:w-80 bg-slate-800 border-l border-white/10 flex flex-col shrink-0">
              {/* Panel header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 shrink-0">
                <div className="flex gap-1">
                  <PanelTab
                    active={sidePanel === 'info'}
                    onClick={() => setSidePanel('info')}
                    icon={Info}
                    label="Detalhes"
                  />
                  <PanelTab
                    active={sidePanel === 'chat'}
                    onClick={() => { setSidePanel('chat'); setUnread(0); }}
                    icon={MessageSquare}
                    label="Chat"
                    badge={unread}
                  />
                </div>
                <button
                  onClick={() => setSidePanel(null)}
                  className="text-white/40 hover:text-white p-1 transition-colors"
                  title="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {sidePanel === 'info' ? (
                <CallInfoPanel
                  doctorName={doctorName}
                  doctorCrm={doctorCrm}
                  consultaId={id ?? ''}
                  connectedAt={connectedAt}
                  durationLabel={durationLabel}
                  quality={quality}
                />
              ) : (
                <CallChatPanel
                  messages={messages}
                  input={chatInput}
                  setInput={setChatInput}
                  onSend={handleSendChat}
                />
              )}
            </aside>
          </>
        )}
      </div>
    );
  }

  // ─── Waiting / Setup / Connecting ─────────────────────────────────────────────
  return (
    <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 text-center max-w-xs">

        {/* Doctor avatar */}
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/30">
          <User className="h-10 w-10 text-primary/70" />
        </div>

        {/* State info */}
        <div>
          <h1 className="text-lg font-bold text-white">{doctorName}</h1>
          <p className="text-sm text-white/50 mt-1">
            {callState === 'setup' && 'Preparando sua consulta...'}
            {callState === 'waiting' && 'Aguardando o médico iniciar a chamada...'}
            {callState === 'connecting' && 'Conectando...'}
          </p>
        </div>

        {/* Elapsed time */}
        {callState === 'waiting' && (
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <Clock className="h-3.5 w-3.5" />
            <span>Na sala há {formatDistanceToNow(waitingSince.current, { locale: ptBR, addSuffix: false })}</span>
          </div>
        )}

        {/* Connecting spinner */}
        {callState === 'connecting' && (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        )}

        {/* Bouncing dots for waiting */}
        {(callState === 'setup' || callState === 'waiting') && (
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary/50 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}

        {/* Local preview */}
        <div className="relative">
          <video
            ref={localVideoWaitRef}
            autoPlay
            muted
            playsInline
            className="w-36 h-24 object-cover rounded-xl border border-white/10"
          />
          <div className="absolute bottom-1.5 right-1.5 flex gap-1">
            {!audioEnabled && <div className="w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center"><MicOff className="h-2.5 w-2.5 text-white" /></div>}
            {!videoEnabled && <div className="w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center"><VideoOff className="h-2.5 w-2.5 text-white" /></div>}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <ControlButton
            active={audioEnabled}
            activeIcon={Mic}
            inactiveIcon={MicOff}
            onClick={handleToggleAudio}
            label=""
            size="sm"
          />
          <ControlButton
            active={videoEnabled}
            activeIcon={Video}
            inactiveIcon={VideoOff}
            onClick={handleToggleVideo}
            label=""
            size="sm"
          />
          <button
            onClick={handleCancelWaiting}
            disabled={cancellingConsulta}
            title="Cancelar consulta"
            className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            {cancellingConsulta
              ? <Loader2 className="h-4 w-4 text-red-400 animate-spin" />
              : <PhoneOff className="h-4 w-4 text-red-400" />
            }
          </button>
        </div>

        {callState === 'waiting' && (
          <p className="text-xs text-white/30 mt-2">
            Clique em <PhoneOff className="inline h-3 w-3" /> para cancelar e sair da fila
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Shared control button ────────────────────────────────────────────────────

function ControlButton({
  active, activeIcon: ActiveIcon, inactiveIcon: InactiveIcon, onClick, label, size = 'md',
}: {
  active: boolean;
  activeIcon: React.ElementType;
  inactiveIcon: React.ElementType;
  onClick: () => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'w-10 h-10' : 'w-12 h-12';
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <button
      onClick={onClick}
      title={label}
      className={`${sizeClass} rounded-full flex items-center justify-center transition-all ${
        active ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'
      }`}
    >
      {active
        ? <ActiveIcon className={`${iconClass} text-white`} />
        : <InactiveIcon className={`${iconClass} text-white`} />
      }
    </button>
  );
}

// ─── Toggle button (chat / info) ──────────────────────────────────────────────

function ToggleButton({
  icon: Icon, active, badge = 0, onClick, label,
}: {
  icon: React.ElementType;
  active: boolean;
  badge?: number;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${
        active ? 'bg-primary text-white' : 'bg-white/10 hover:bg-white/20 text-white'
      }`}
    >
      <Icon className="h-5 w-5" />
      {badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

// ─── Panel tab ────────────────────────────────────────────────────────────────

function PanelTab({
  active, onClick, icon: Icon, label, badge = 0,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {badge > 0 && (
        <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

// ─── Connection quality indicator ─────────────────────────────────────────────

function qualityLabel(q: Quality) {
  return q === 'good' ? 'Boa conexão' : q === 'fair' ? 'Conexão média' : 'Conexão fraca';
}

function QualityIndicator({ quality }: { quality: Quality }) {
  const cfg = {
    good: { Icon: SignalHigh, color: 'text-green-400' },
    fair: { Icon: SignalMedium, color: 'text-amber-400' },
    poor: { Icon: SignalLow, color: 'text-red-400' },
  }[quality];
  const { Icon, color } = cfg;
  return (
    <span className={`hidden sm:flex items-center ${color}`} title={qualityLabel(quality)}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

// ─── Duration formatter ───────────────────────────────────────────────────────

function formatDuration(start: Date | null, now: number) {
  if (!start) return '00:00';
  const total = Math.max(0, Math.floor((now - start.getTime()) / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Call info panel ──────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80 font-medium">{value}</span>
    </div>
  );
}

function CallInfoPanel({
  doctorName, doctorCrm, consultaId, connectedAt, durationLabel, quality,
}: {
  doctorName: string;
  doctorCrm: string;
  consultaId: string;
  connectedAt: Date | null;
  durationLabel: string;
  quality: Quality;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {/* Doctor card */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <Stethoscope className="h-6 w-6 text-primary/80" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{doctorName}</p>
          <p className="text-xs text-white/50 truncate">Clínico Geral{doctorCrm ? ` · ${doctorCrm}` : ''}</p>
        </div>
      </div>

      {/* Details */}
      <div>
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1">Consulta</p>
        <InfoRow
          label="Status"
          value={
            <span className="flex items-center gap-1.5 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Em andamento
            </span>
          }
        />
        <InfoRow label="Duração" value={<span className="tabular-nums">{durationLabel}</span>} />
        <InfoRow
          label="Início"
          value={connectedAt ? connectedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
        />
        <InfoRow label="Conexão" value={qualityLabel(quality)} />
        <InfoRow label="ID" value={<span className="font-mono">#{consultaId.slice(0, 8)}</span>} />
      </div>

      {/* Trust note */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex gap-2.5">
        <ShieldCheck className="h-4 w-4 text-green-400/80 shrink-0 mt-0.5" />
        <p className="text-xs text-white/60 leading-relaxed">
          Sua consulta é privada e criptografada. Ao final, receitas, atestados e pedidos de exame
          ficarão disponíveis em <span className="text-white/80 font-medium">Prescrições</span>.
        </p>
      </div>
    </div>
  );
}

// ─── Call chat panel ──────────────────────────────────────────────────────────

function CallChatPanel({
  messages, input, setInput, onSend,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-2">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-white/30" />
            </div>
            <p className="text-sm text-white/50">Nenhuma mensagem ainda</p>
            <p className="text-xs text-white/30">
              Use o chat para compartilhar sintomas, nomes de medicamentos ou dúvidas com o médico.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === 'patient' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  m.from === 'patient'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-white/10 text-white rounded-bl-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                <p className={`text-[10px] mt-0.5 ${m.from === 'patient' ? 'text-white/60' : 'text-white/40'}`}>
                  {new Date(m.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
        className="p-3 border-t border-white/10 flex items-center gap-2 shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite uma mensagem..."
          className="flex-1 bg-white/10 text-white text-sm rounded-full px-4 py-2 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-9 h-9 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center shrink-0 transition-colors"
          title="Enviar"
        >
          <Send className="h-4 w-4 text-white" />
        </button>
      </form>
    </div>
  );
}
