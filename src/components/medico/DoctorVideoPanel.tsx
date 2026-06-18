import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSignaling } from '@/hooks/useSignaling';
import { useToast } from '@/hooks/use-toast';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Loader2,
  User, WifiOff, Minus, Maximize2, Minimize2, ChevronUp, Move,
  MessageSquare, X, Send, Stethoscope, Activity, Pill, Paperclip, FileText,
  SignalHigh, SignalMedium, SignalLow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { IntakeData } from '@/lib/consultaDraft';
import { openExamFile } from '@/lib/examFiles';
import { logEvent } from '@/lib/audit';
import { mediaErrorMessage, mediaErrorDetail } from '@/lib/mediaErrors';

type PanelStage = 'starting' | 'calling' | 'in_call' | 'reconnecting' | 'error';
type View = 'floating' | 'minimized' | 'maximized';
type Quality = 'good' | 'fair' | 'poor';

function qualityLabel(q: Quality) {
  return q === 'good' ? 'Boa conexão' : q === 'fair' ? 'Conexão média' : 'Conexão fraca';
}

function fmtDuration(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return (h > 0 ? `${h}:` : '') + `${mm}:${String(sec).padStart(2, '0')}`;
}

function QualityIndicator({ quality }: { quality: Quality }) {
  const cfg = {
    good: { Icon: SignalHigh, color: 'text-green-400' },
    fair: { Icon: SignalMedium, color: 'text-amber-400' },
    poor: { Icon: SignalLow, color: 'text-red-400' },
  }[quality];
  const { Icon, color } = cfg;
  return (
    <span className={color} title={qualityLabel(quality)}>
      <Icon className="h-3 w-3" />
    </span>
  );
}

interface ChatMessage {
  id: string;
  from: 'patient' | 'doctor';
  text: string;
  at: number;
}

interface Props {
  consultationId: string;
  patientName: string;
  onCallEnded: () => void;
  consultationDate?: string;
  intake?: IntakeData | null;
}

export function DoctorVideoPanel({ consultationId, patientName, onCallEnded, consultationDate, intake }: Props) {
  const { toast } = useToast();

  const [stage, setStage] = useState<PanelStage>('starting');
  const [errorDetail, setErrorDetail] = useState(''); // surfaced cause of a media/connection error
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [quality, setQuality] = useState<Quality>('good');
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [patientAudio, setPatientAudio] = useState(true);
  const [patientVideo, setPatientVideo] = useState(true);

  // Floating window position / size / view mode
  const PANEL_W = 340, PANEL_H = 460;
  const [view, setView] = useState<View>('floating');
  const [pos, setPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(16, window.innerWidth - PANEL_W - 24) : 24,
    y: typeof window !== 'undefined' ? Math.max(72, window.innerHeight - PANEL_H - 24) : 72,
  }));
  const [size, setSize] = useState({ w: PANEL_W, h: PANEL_H });
  const [drag, setDrag] = useState<
    | null
    | { mode: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number }
  >(null);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [sideTab, setSideTab] = useState<'info' | 'chat'>('info');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unread, setUnread] = useState(0);
  const chatVisibleRef = useRef(false); // updated before render return
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Track whether stream is ready so we don't create offer before media loads
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const signaling = useSignaling(consultationId);
  const signalingRef = useRef(signaling);
  signalingRef.current = signaling;

  // The WebRTC offer is created exactly ONCE and re-broadcast unchanged on every
  // patient-ready. Sending a fresh createOffer() each time mints a different SDP,
  // and the patient ends up answering several offers → glare / concurrent
  // renegotiation that breaks media one-way (the panel sees the patient but the
  // patient never gets our stream). One stable offer keeps the handshake clean.
  const offerRef = useRef<RTCSessionDescriptionInit | null>(null);
  const connectedRef = useRef(false);

  const webrtc = useWebRTC({
    onRemoteStream: useCallback((stream: MediaStream) => {
      connectedRef.current = true;
      setRemoteStream(stream);
      setStage('in_call');
    }, []),
    onConnectionStateChange: useCallback((state: RTCPeerConnectionState) => {
      if (state === 'disconnected') setStage('reconnecting');
      if (state === 'connected') { connectedRef.current = true; setStage('in_call'); }
      // 'failed' no longer ends the call: the ICE-restart offer (onRenegotiationOffer)
      // gets a chance to recover. Intentional hangups arrive via 'call-ended'; a
      // local close() surfaces as 'closed'.
      if (state === 'failed') setStage('reconnecting');
      if (state === 'closed') onCallEnded();
    }, [onCallEnded]),
    onIceCandidate: useCallback((candidate: RTCIceCandidateInit) => {
      signalingRef.current.send('ice-candidate', candidate as Record<string, unknown>);
    }, []),
    // ICE failed → useWebRTC minted a fresh ICE-restart offer. Cache it as the
    // current offer (so the patient-ready heartbeat re-sends the NEW one, never the
    // stale pre-restart SDP) and re-signal it so the patient renegotiates.
    onRenegotiationOffer: useCallback((offer: RTCSessionDescriptionInit) => {
      offerRef.current = offer;
      signalingRef.current.send('call-offer', offer as Record<string, unknown>);
    }, []),
  });

  // Keep the latest streams in refs so the callback refs below can (re)attach the
  // moment the <video> element (re)mounts — critically, after the panel is
  // minimized (the whole subtree unmounts) and restored, which otherwise left the
  // element with no srcObject = black. The effects handle the reverse case: the
  // element is already mounted and the stream arrives later.
  const localStreamRef = useRef<MediaStream | null>(null);
  localStreamRef.current = localStream;
  const remoteStreamRef = useRef<MediaStream | null>(null);
  remoteStreamRef.current = remoteStream;

  const attachLocal = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
      el.srcObject = localStreamRef.current;
      el.play().catch(() => { /* muted autoplay já cobre */ });
    }
  }, []);

  const attachRemote = useCallback((el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el && remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) {
      el.srcObject = remoteStreamRef.current;
      el.play().catch(() => { /* o médico chegou via clique → unmuted ok */ });
    }
  }, []);

  useEffect(() => {
    const el = localVideoRef.current;
    if (el && localStream && el.srcObject !== localStream) {
      el.srcObject = localStream;
      el.play().catch(() => { /* ignore */ });
    }
  }, [localStream]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (el && remoteStream && el.srcObject !== remoteStream) {
      el.srcObject = remoteStream;
      el.play().catch(() => { /* ignore */ });
    }
  }, [remoteStream]);

  // On mount: acquire media → create PC → send doctor-ready → create offer
  useEffect(() => {
    let mounted = true;

    const start = async () => {
      try {
        // Acquire a camera that is genuinely producing frames. Handles permission/
        // missing/busy AND the "resolved but black" case (track present but muted)
        // that the attendant→doctor handoff triggers on shared hardware.
        const stream = await webrtc.acquireLiveCamera();
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

        setLocalStream(stream);
        webrtc.createPeerConnection();

        signaling.track({ role: 'doctor', consultation_id: consultationId });
        signaling.send('doctor-ready', { consultation_id: consultationId });

        setStage('calling');

        const offer = await webrtc.createOffer();
        offerRef.current = offer;
        signalingRef.current.send('call-offer', offer as Record<string, unknown>);
        logEvent('doctor_started_call', { consultationId });
      } catch (err) {
        if (!mounted) return;
        setErrorDetail(mediaErrorDetail(err));
        toast({
          title: 'Erro ao acessar câmera',
          description: mediaErrorMessage(err),
          variant: 'destructive',
        });
        setStage('error');
      }
    };

    start();
    return () => { mounted = false; };
  }, [consultationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register signaling handlers
  useEffect(() => {
    signaling.on('call-answer', async (payload) => {
      await webrtc.setAnswer(payload as RTCSessionDescriptionInit);
    });

    signaling.on('ice-candidate', async (payload) => {
      await webrtc.addIceCandidate(payload as RTCIceCandidateInit);
    });

    signaling.on('call-ended', () => {
      webrtc.closeConnection();
      onCallEnded();
    });

    signaling.on('media-state', (payload) => {
      if (typeof payload.audio === 'boolean') setPatientAudio(payload.audio);
      if (typeof payload.video === 'boolean') setPatientVideo(payload.video);
    });

    signaling.on('chat-message', (payload) => {
      const text = typeof payload.text === 'string' ? payload.text : '';
      if (!text) return;
      const msg: ChatMessage = {
        id: typeof payload.id === 'string' ? payload.id : crypto.randomUUID(),
        from: 'patient',
        text,
        at: typeof payload.at === 'number' ? payload.at : Date.now(),
      };
      setMessages(prev => [...prev, msg]);
      if (!chatVisibleRef.current) setUnread(u => u + 1);
    });

    // If patient sends patient-ready after we already started, RE-SEND the same
    // offer (never a fresh one — that would change the SDP mid-handshake). Once
    // connected we stop, so a late heartbeat can't trigger a renegotiation.
    signaling.on('patient-ready', async () => {
      if (connectedRef.current) return;
      try {
        let offer = offerRef.current;
        if (!offer) {
          offer = await webrtc.createOffer();
          offerRef.current = offer;
        }
        signalingRef.current.send('call-offer', offer as Record<string, unknown>);
        setStage('calling');
      } catch { /* ignore */ }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => webrtc.closeConnection(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark when the call actually connected (for the duration timer)
  useEffect(() => {
    if (stage === 'in_call' && connectedAt == null) setConnectedAt(Date.now());
  }, [stage, connectedAt]);

  // Tick the call-duration timer every second once connected
  useEffect(() => {
    if (connectedAt == null) return;
    const t = setInterval(() => setCallSeconds(Math.floor((Date.now() - connectedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [connectedAt]);

  // Real connection-quality polling via WebRTC getStats (same thresholds as the
  // patient side) — replaces the previously static green Wi-Fi icon.
  useEffect(() => {
    if (stage !== 'in_call') return;
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
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat (overlay in floating mode, side tab in fullscreen)
  useEffect(() => {
    const chatVisible = (view !== 'maximized' && chatOpen) || (view === 'maximized' && sideTab === 'chat');
    if (chatVisible) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatOpen, view, sideTab]);

  // Drag / resize the floating window
  useEffect(() => {
    if (!drag) return;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const onMove = (e: PointerEvent) => {
      if (drag.mode === 'move') {
        setPos({
          x: clamp(drag.ox + (e.clientX - drag.sx), 8, window.innerWidth - size.w - 8),
          y: clamp(drag.oy + (e.clientY - drag.sy), 8, window.innerHeight - 56),
        });
      } else {
        setSize({
          w: clamp(drag.ow + (e.clientX - drag.sx), 280, Math.min(720, window.innerWidth - pos.x - 8)),
          h: clamp(drag.oh + (e.clientY - drag.sy), 320, Math.min(820, window.innerHeight - pos.y - 8)),
        });
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, size.w, pos.x, pos.y]);

  const startMove = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setDrag({ mode: 'move', sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, ow: size.w, oh: size.h });
  };
  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    setDrag({ mode: 'resize', sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, ow: size.w, oh: size.h });
  };

  const handleEndCall = () => {
    signaling.send('call-ended', { initiated_by: 'doctor' });
    logEvent('doctor_left_call', { consultationId, payload: { initiated_by: 'doctor' } });
    webrtc.closeConnection();
    onCallEnded();
  };

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    const msg: ChatMessage = { id: crypto.randomUUID(), from: 'doctor', text, at: Date.now() };
    setMessages(prev => [...prev, msg]);
    signaling.send('chat-message', { id: msg.id, text: msg.text, at: msg.at });
    setChatInput('');
  };

  const handleChatButton = () => {
    if (view === 'maximized') {
      setSideTab(t => (t === 'chat' ? 'info' : 'chat'));
      setUnread(0);
      return;
    }
    if (chatOpen) setChatOpen(false);
    else { setChatOpen(true); setUnread(0); }
  };

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

  // ─── Floating window ────────────────────────────────────────────────────────
  const maximized = view === 'maximized';
  const minimized = view === 'minimized';
  const cardStyle: React.CSSProperties = maximized
    ? { left: 12, top: 12, right: 12, bottom: 12 }
    : { left: pos.x, top: pos.y, width: size.w, height: minimized ? undefined : size.h };

  // Whether the chat thread is currently on screen (for unread tracking)
  const chatVisible = (!maximized && chatOpen) || (maximized && sideTab === 'chat');
  chatVisibleRef.current = chatVisible;

  return (
    <div
      style={cardStyle}
      className="fixed z-40 bg-slate-900 rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden"
    >
      {/* Header — drag handle */}
      <div
        onPointerDown={maximized ? undefined : startMove}
        className={`flex items-center justify-between px-3 py-2 border-b border-white/10 bg-slate-800/80 select-none shrink-0 ${maximized ? 'cursor-default' : 'cursor-move'}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {stage === 'in_call' && (
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          )}
          {!maximized && <Move className="h-3.5 w-3.5 text-white/30 shrink-0" />}
          <span className="text-xs font-medium text-white/70 truncate">
            {stage === 'starting' && 'Iniciando câmera...'}
            {stage === 'calling' && 'Aguardando paciente...'}
            {stage === 'in_call' && `Em chamada — ${patientName}`}
            {stage === 'reconnecting' && 'Reconectando...'}
            {stage === 'error' && 'Erro na chamada'}
          </span>
          {stage === 'in_call' && (
            <span className="flex items-center gap-1.5 shrink-0 ml-1">
              <QualityIndicator quality={quality} />
              <span className="text-[11px] font-mono text-white/60 tabular-nums">{fmtDuration(callSeconds)}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          {/* Fullscreen / restore */}
          {!minimized && (
            <button
              onClick={() => setView(v => (v === 'maximized' ? 'floating' : 'maximized'))}
              className="text-white/40 hover:text-white transition-colors p-1"
              title={maximized ? 'Restaurar tamanho' : 'Tela cheia'}
              aria-label={maximized ? 'Restaurar tamanho' : 'Tela cheia'}
            >
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
          {/* Minimize / restore */}
          {!maximized && (
            <button
              onClick={() => setView(v => (v === 'minimized' ? 'floating' : 'minimized'))}
              className="text-white/40 hover:text-white transition-colors p-1"
              title={minimized ? 'Restaurar' : 'Minimizar'}
              aria-label={minimized ? 'Restaurar janela' : 'Minimizar janela'}
            >
              {minimized ? <ChevronUp className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            </button>
          )}
          {/* End call (asks for confirmation — easy to misclick this corner) */}
          <button
            onClick={() => setConfirmEnd(true)}
            className="text-white/40 hover:text-red-400 transition-colors p-1"
            title="Encerrar chamada"
            aria-label="Encerrar chamada"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {minimized ? null : (
      <>
      {/* Content: video + (fullscreen) side column */}
      <div className="flex-1 min-h-0 flex">
        {/* Remote video area */}
        <div className="flex-1 relative bg-slate-800 min-h-0">
        {/* Remote video */}
        <video
          ref={attachRemote}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${stage !== 'in_call' ? 'hidden' : ''}`}
        />

        {/* Patient avatar when no video */}
        {stage === 'in_call' && !patientVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-8 w-8 text-primary/60" />
            </div>
          </div>
        )}

        {/* Waiting / connecting states */}
        {(stage === 'starting' || stage === 'calling') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-7 w-7 text-primary/50" />
            </div>
            <p className="text-xs text-white/40 text-center px-4">
              {stage === 'starting' ? 'Preparando câmera...' : `Aguardando ${patientName} conectar...`}
            </p>
            <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
          </div>
        )}

        {stage === 'reconnecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-800/80">
            <WifiOff className="h-6 w-6 text-amber-400" />
            <p className="text-xs text-amber-300">Reconectando...</p>
          </div>
        )}

        {stage === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <WifiOff className="h-6 w-6 text-red-400" />
            <p className="text-xs text-red-300">Falha na conexão</p>
            {errorDetail && (
              <p className="text-[10px] text-white/50 font-mono break-words max-w-full">{errorDetail}</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 mt-1"
              onClick={onCallEnded}
            >
              Fechar painel
            </Button>
          </div>
        )}

        {/* Status indicators (in_call) */}
        {stage === 'in_call' && (
          <>
            {!patientAudio && (
              <div className="absolute top-2 left-2 bg-black/50 rounded-full px-1.5 py-0.5 flex items-center gap-1 text-[10px] text-white">
                <MicOff className="h-2.5 w-2.5 text-red-400" /> sem áudio
              </div>
            )}
            {stage === 'in_call' && (
              <div className="absolute top-2 right-2 bg-black/40 rounded-full p-1">
                <QualityIndicator quality={quality} />
              </div>
            )}
          </>
        )}

        {/* Local video PiP */}
        <div className={`absolute bottom-2 right-2 rounded-lg overflow-hidden border border-white/20 shadow-md ${maximized ? 'w-48 h-32' : 'w-20 h-14'} ${stage === 'in_call' || stage === 'calling' || stage === 'starting' ? 'block' : 'hidden'}`}>
          <video
            ref={attachLocal}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!videoEnabled && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
              <VideoOff className="h-3 w-3 text-white/40" />
            </div>
          )}
        </div>

        {/* Chat overlay — floating / minimized mode */}
        {!maximized && chatOpen && (
          <div className="absolute inset-0 z-10 bg-slate-900 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
              <span className="text-xs font-medium text-white/70 flex items-center gap-1.5 min-w-0">
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Chat — {patientName}</span>
              </span>
              <button
                onClick={() => setChatOpen(false)}
                className="text-white/40 hover:text-white shrink-0"
                title="Fechar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ChatThread
              messages={messages}
              input={chatInput}
              setInput={setChatInput}
              onSend={handleSendChat}
              endRef={chatEndRef}
            />
          </div>
        )}
        </div>{/* end video area */}

        {/* Side column — fullscreen: Info da consulta / Chat */}
        {maximized && (
          <aside className="w-80 shrink-0 border-l border-white/10 bg-slate-900 flex flex-col min-h-0">
            <div className="flex shrink-0 border-b border-white/10">
              <SideTabButton
                active={sideTab === 'info'}
                onClick={() => setSideTab('info')}
                icon={Stethoscope}
                label="Info da consulta"
              />
              <SideTabButton
                active={sideTab === 'chat'}
                onClick={() => { setSideTab('chat'); setUnread(0); }}
                icon={MessageSquare}
                label="Chat"
                badge={sideTab === 'chat' ? 0 : unread}
              />
            </div>
            {sideTab === 'info' ? (
              <ConsultaInfoColumn patientName={patientName} date={consultationDate} intake={intake} />
            ) : (
              <ChatThread
                messages={messages}
                input={chatInput}
                setInput={setChatInput}
                onSend={handleSendChat}
                endRef={chatEndRef}
              />
            )}
          </aside>
        )}
      </div>{/* end content row */}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-3 py-3 border-t border-white/10 shrink-0">
        <PanelControlBtn
          active={audioEnabled}
          activeIcon={Mic}
          inactiveIcon={MicOff}
          onClick={handleToggleAudio}
          label={audioEnabled ? 'Mutar' : 'Ativar áudio'}
        />
        <PanelControlBtn
          active={videoEnabled}
          activeIcon={Video}
          inactiveIcon={VideoOff}
          onClick={handleToggleVideo}
          label={videoEnabled ? 'Ocultar câmera' : 'Ativar câmera'}
        />
        <button
          onClick={handleChatButton}
          title="Chat"
          aria-label={unread > 0 ? `Chat (${unread} não lidas)` : 'Chat'}
          className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
            chatVisible ? 'bg-primary hover:bg-primary/90' : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          <MessageSquare className="h-4 w-4 text-white" />
          {unread > 0 && !chatVisible && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        <button
          onClick={() => setConfirmEnd(true)}
          title="Encerrar chamada"
          aria-label="Encerrar chamada"
          className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          <PhoneOff className="h-4 w-4 text-white" />
        </button>
      </div>

      {/* Resize handle (floating mode only) */}
      {!maximized && (
        <div
          onPointerDown={startResize}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1 z-20"
          title="Redimensionar"
        >
          <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-white/30 rounded-sm" />
        </div>
      )}
      </>
      )}

      {/* End-call confirmation — clarifies that ending the call does NOT finish
          the consultation (documents stay editable; use Finalizar to conclude). */}
      {confirmEnd && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center text-center p-5 rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mb-3">
            <PhoneOff className="h-6 w-6 text-red-400" />
          </div>
          <p className="text-sm font-semibold text-white">Encerrar a videochamada?</p>
          <p className="text-xs text-white/60 mt-1.5 max-w-[260px]">
            O atendimento continua aberto — você ainda pode emitir e assinar documentos.
            Para concluir a consulta, use <span className="text-white/90 font-medium">Finalizar</span>.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setConfirmEnd(false)}
            >
              Continuar na chamada
            </Button>
            <Button
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => { setConfirmEnd(false); handleEndCall(); }}
            >
              Encerrar chamada
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PanelControlBtn({
  active, activeIcon: A, inactiveIcon: I, onClick, label,
}: {
  active: boolean;
  activeIcon: React.ElementType;
  inactiveIcon: React.ElementType;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={!active}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
        active ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'
      }`}
    >
      {active ? <A className="h-4 w-4 text-white" /> : <I className="h-4 w-4 text-white" />}
    </button>
  );
}

// ─── Chat thread (messages + input) — reused in overlay and side column ───────

function ChatThread({
  messages, input, setInput, onSend, endRef,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  endRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-3 gap-1.5">
            <MessageSquare className="h-6 w-6 text-white/20" />
            <p className="text-xs text-white/40">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === 'doctor' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-2.5 py-1.5 ${
                  m.from === 'doctor'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-white/10 text-white rounded-bl-sm'
                }`}
              >
                <p className="text-xs whitespace-pre-wrap break-words">{m.text}</p>
                <p className={`text-[9px] mt-0.5 ${m.from === 'doctor' ? 'text-white/60' : 'text-white/40'}`}>
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
        className="p-2.5 border-t border-white/10 flex items-center gap-1.5 shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mensagem..."
          className="flex-1 bg-white/10 text-white text-xs rounded-full px-3 py-1.5 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center shrink-0"
          title="Enviar"
        >
          <Send className="h-3.5 w-3.5 text-white" />
        </button>
      </form>
    </div>
  );
}

// ─── Side column tab button (fullscreen) ──────────────────────────────────────

function SideTabButton({
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
      className={`relative flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors border-b-2 ${
        active
          ? 'border-primary text-white bg-white/5'
          : 'border-transparent text-white/50 hover:text-white/80'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {badge > 0 && (
        <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

// ─── Consultation info column (fullscreen) ────────────────────────────────────

function ConsultaInfoColumn({
  patientName, date, intake,
}: {
  patientName: string;
  date?: string;
  intake?: IntakeData | null;
}) {
  let dateLabel = '';
  if (date) {
    try { dateLabel = new Date(date).toLocaleDateString('pt-BR'); } catch { dateLabel = ''; }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Patient */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-primary/80" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{patientName}</p>
          <p className="text-xs text-white/40">Paciente{dateLabel ? ` · ${dateLabel}` : ''}</p>
        </div>
      </div>

      {!intake ? (
        <p className="text-xs text-white/40 italic">Sem informações de pré-consulta.</p>
      ) : (
        <>
          {/* Symptoms */}
          <div>
            <p className="text-[11px] font-medium text-white/40 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
              <Activity className="h-3.5 w-3.5" /> Sintomas
            </p>
            {intake.sintomas.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {intake.sintomas.map((s) => (
                  <span
                    key={s}
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      s === intake.sintomaPrincipal
                        ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 font-medium'
                        : 'bg-white/5 text-white/70 border-white/10'
                    }`}
                  >
                    {s}{s === intake.sintomaPrincipal ? ' · principal' : ''}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/40 italic">Nenhum sintoma informado</p>
            )}
          </div>

          {/* Medications */}
          <div>
            <p className="text-[11px] font-medium text-white/40 flex items-center gap-1.5 mb-1 uppercase tracking-wide">
              <Pill className="h-3.5 w-3.5" /> Medicamentos em uso
            </p>
            <p className="text-sm text-white/80">{intake.medicamentos?.trim() || 'Nenhum informado'}</p>
          </div>

          {/* Exam files */}
          {intake.exames.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-white/40 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
                <Paperclip className="h-3.5 w-3.5" /> Exames anexados
              </p>
              <div className="space-y-1.5">
                {intake.exames.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openExamFile(ex)}
                    className="flex w-full items-center gap-2 p-2 rounded-lg border border-white/10 bg-white/5 hover:border-primary/40 hover:bg-white/10 transition-colors text-xs text-white/80 text-left"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 truncate">{ex.name}</span>
                    <span className="text-[10px] text-primary">Abrir</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
