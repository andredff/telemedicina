import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { normalizeStatus } from '@/lib/consultationStatus';
import {
  Video, VideoOff, Mic, MicOff, CheckCircle, AlertCircle,
  Camera, RefreshCw, ChevronRight, Stethoscope,
} from 'lucide-react';

type DeviceStatus = 'idle' | 'requesting' | 'ok' | 'denied' | 'unavailable';

export default function PreparacaoConsulta() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cameraStatus, setCameraStatus] = useState<DeviceStatus>('idle');
  const [micStatus, setMicStatus] = useState<DeviceStatus>('idle');
  // True once the attendant routed the patient to the doctor pool — the patient
  // already did the first contact and is now waiting for a doctor to take over.
  const [awaitingDoctor, setAwaitingDoctor] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Last seen doctor_calling_at so we only jump into the call on a NEW ring (the
  // value is already set from the attendant's earlier call — don't bounce on it).
  const lastCallingRef = useRef<string | null>(null);
  // Guards against the camera leak that caused NotReadableError downstream: if
  // the doctor rings while getUserMedia is still pending, the page navigates away
  // before the stream resolves; without this the orphaned stream is never stopped
  // and keeps the camera busy, so the call room can't open it.
  const mountedRef = useRef(true);
  // Single-shot navigation guard + missed-ring safety-net timer (see goToCall).
  const navigatedRef = useRef(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasWebRTC = typeof window !== 'undefined' && !!window.RTCPeerConnection;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, []);

  // Enter the call exactly once: stop the local preview (frees the camera for the
  // call room) and navigate. Idempotent — safe to call from the ring event, the
  // status fallback, and the manual "I'm ready" button.
  const goToCall = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    if (fallbackTimer.current) { clearTimeout(fallbackTimer.current); fallbackTimer.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    navigate(`/consulta/${id}/chamada`);
  }, [id, navigate]);

  // Missed-ring safety net: the doctor accepting sets status=in_consultation and
  // THEN rings (doctor_calling_at). If that ring is missed (realtime gap / late
  // mount), the patient would wait forever while the doctor sees "aguardando
  // paciente". Once we observe in_consultation, arm a short fallback that pulls
  // the patient into the call even if the ring never lands. The ring still wins
  // the race in the common case (preserving the doctor-camera-first ordering).
  const armDoctorFallback = useCallback(() => {
    if (navigatedRef.current || fallbackTimer.current) return;
    fallbackTimer.current = setTimeout(() => goToCall(), 4000);
  }, [goToCall]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('consultations')
      .select('doctor_name, status, doctor_calling_at')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        // Room guard (CARD-05): closed/foreign consultations don't reach the call.
        if (!data) { navigate('/teleconsultas', { replace: true }); return; }
        const status = (data as { status?: string }).status;
        if (status === 'completed') { navigate(`/consulta/${id}/detalhes`, { replace: true }); return; }
        if (status === 'cancelled') { navigate('/teleconsultas', { replace: true }); return; }
        lastCallingRef.current = (data as { doctor_calling_at?: string | null }).doctor_calling_at ?? null;
        const ns = normalizeStatus(status);
        setAwaitingDoctor(ns === 'waiting_doctor' || ns === 'routed_to_doctor');
        // Patient landed here AFTER the doctor already took over (ring likely
        // already fired/missed) → fall into the call instead of waiting forever.
        if (ns === 'in_consultation') armDoctorFallback();
      });

    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [id, navigate, armDoctorFallback]);

  // Realtime: while the patient is still on the device-check screen, a staff
  // member (attendant during first contact, or the doctor) may start the call.
  // The "calling" signal bumps doctor_calling_at — when it changes, pull the
  // patient into the call room so the WebRTC offer finds an answerer.
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`prep-calling-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'consultations', filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as { status?: string; doctor_calling_at?: string | null };
          if (row.status === 'completed') { navigate(`/consulta/${id}/detalhes`, { replace: true }); return; }
          if (row.status === 'cancelled') { navigate('/teleconsultas', { replace: true }); return; }
          const ns = normalizeStatus(row.status);
          setAwaitingDoctor(ns === 'waiting_doctor' || ns === 'routed_to_doctor');
          // Doctor took the consultation → arm the missed-ring safety net.
          if (ns === 'in_consultation') armDoctorFallback();
          // Fast path: a NEW ring arrived (doctor_calling_at changed). The value is
          // already set from the attendant's first-contact call, so reacting to its
          // mere presence would bounce the patient back — only act on a change.
          if (row.doctor_calling_at && row.doctor_calling_at !== lastCallingRef.current) {
            lastCallingRef.current = row.doctor_calling_at;
            goToCall();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, navigate, goToCall, armDoctorFallback]);

  // Auto-start the device test on entry. The patient already granted camera/mic
  // permission in the wizard, so this opens the preview without a second prompt.
  // If permission isn't there (denied/revoked), it falls back to the manual retry UI.
  useEffect(() => {
    if (!hasWebRTC) return;
    requestMedia();
  }, [hasWebRTC]);

  const requestMedia = async () => {
    setCameraStatus('requesting');
    setMicStatus('requesting');
    // Escalating backoff: on reentry the camera may still be releasing from the
    // previous leg (NotReadableError). Wait it out instead of failing immediately
    // and mislabeling a busy device as "permission denied".
    const BUSY_BACKOFF = [300, 600, 1000, 1500, 2000];
    for (let attempt = 0; attempt <= BUSY_BACKOFF.length; attempt++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // Navigated away (e.g. doctor rang) while acquiring → release immediately,
        // otherwise the camera stays busy and the call room fails to open it.
        if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraStatus('ok');
        setMicStatus('ok');
        return;
      } catch (err) {
        const name = (err as Error).name;
        const busy = name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError';
        if (busy && attempt < BUSY_BACKOFF.length && mountedRef.current) {
          await new Promise(r => setTimeout(r, BUSY_BACKOFF[attempt]));
          continue; // camera still releasing from the previous leg → wait & retry
        }
        if (!mountedRef.current) return;
        const status: DeviceStatus = (name === 'NotAllowedError' || name === 'PermissionDeniedError')
          ? 'denied'
          : name === 'NotFoundError' ? 'unavailable' : 'denied';
        setCameraStatus(status);
        setMicStatus(status);
        return;
      }
    }
  };

  const handleProceed = () => {
    goToCall();
  };

  const allReady = cameraStatus === 'ok' && micStatus === 'ok';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <Video className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Preparação para a Consulta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vamos verificar sua câmera e microfone antes de iniciar o atendimento
          </p>
        </div>

        {/* Triage done → waiting for a doctor to take over */}
        {awaitingDoctor && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 flex gap-3 text-sm text-green-800">
              <Stethoscope className="h-5 w-5 shrink-0 mt-0.5 text-green-600" />
              <div>
                <p className="font-semibold">Triagem concluída</p>
                <p className="mt-0.5 text-green-700">
                  Um médico irá continuar a sua consulta. Aguarde nesta sala — você entrará
                  na chamada automaticamente assim que o médico chamar.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* WebRTC check */}
        {!hasWebRTC && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 flex gap-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Navegador incompatível</p>
                <p className="mt-0.5">Use Google Chrome, Firefox ou Edge (versão recente).</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Camera preview */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative bg-gray-900 aspect-video rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${cameraStatus !== 'ok' ? 'hidden' : ''}`}
              />
              {cameraStatus !== 'ok' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
                  <Camera className="h-10 w-10 opacity-30" />
                  <p className="text-sm text-white/50">
                    {cameraStatus === 'idle' && 'Câmera não iniciada'}
                    {cameraStatus === 'requesting' && 'Solicitando permissão...'}
                    {cameraStatus === 'denied' && 'Permissão negada'}
                    {cameraStatus === 'unavailable' && 'Câmera não encontrada'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Device status cards */}
        <div className="grid grid-cols-2 gap-3">
          <DeviceCard icon={cameraStatus === 'ok' ? Video : VideoOff} label="Câmera" status={cameraStatus} />
          <DeviceCard icon={micStatus === 'ok' ? Mic : MicOff} label="Microfone" status={micStatus} />
        </div>

        {/* Permission denied help */}
        {(cameraStatus === 'denied' || micStatus === 'denied') && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Como habilitar a câmera:</p>
              <ul className="space-y-1 text-xs list-disc list-inside text-amber-700">
                <li>Chrome: clique no cadeado na barra de endereços → Permissões do site</li>
                <li>Firefox: clique no ícone de câmera na barra de endereços</li>
                <li>Safari: Ajustes → Safari → Câmera e Microfone → Perguntar</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {cameraStatus === 'idle' && (
            <Button className="w-full gap-2" onClick={requestMedia} disabled={!hasWebRTC}>
              <Camera className="h-4 w-4" />
              Testar Câmera e Microfone
            </Button>
          )}
          {cameraStatus === 'requesting' && (
            <Button className="w-full gap-2" disabled>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Aguardando permissão do navegador...
            </Button>
          )}
          {(cameraStatus === 'denied' || cameraStatus === 'unavailable') && (
            <Button variant="outline" className="w-full gap-2" onClick={requestMedia}>
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          )}
          {allReady && (
            <Button
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
              onClick={handleProceed}
            >
              Estou pronto — entrar na consulta
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground pb-2">
          Você entrará na sala de espera virtual. Um atendente fará o primeiro contato e depois encaminha você ao médico.
        </p>
      </div>
    </div>
  );
}

function DeviceCard({
  icon: Icon, label, status,
}: { icon: React.ElementType; label: string; status: DeviceStatus }) {
  const cfg = {
    idle:        { cls: 'bg-gray-50 border-gray-200',    text: 'text-gray-400',  sub: 'Não verificado' },
    requesting:  { cls: 'bg-blue-50 border-blue-200',    text: 'text-blue-500',  sub: 'Verificando...' },
    ok:          { cls: 'bg-green-50 border-green-200',  text: 'text-green-600', sub: 'Funcionando' },
    denied:      { cls: 'bg-red-50 border-red-200',      text: 'text-red-500',   sub: 'Bloqueado' },
    unavailable: { cls: 'bg-amber-50 border-amber-200',  text: 'text-amber-500', sub: 'Não encontrado' },
  }[status];

  return (
    <div className={`rounded-xl border p-3 flex items-center gap-2.5 ${cfg.cls}`}>
      <Icon className={`h-4 w-4 ${cfg.text}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className={`text-[10px] ${cfg.text}`}>{cfg.sub}</p>
      </div>
      {status === 'ok' && <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />}
    </div>
  );
}
