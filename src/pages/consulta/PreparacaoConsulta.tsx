import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  Video, VideoOff, Mic, MicOff, CheckCircle, AlertCircle,
  Camera, RefreshCw, ChevronRight,
} from 'lucide-react';

type DeviceStatus = 'idle' | 'requesting' | 'ok' | 'denied' | 'unavailable';

export default function PreparacaoConsulta() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cameraStatus, setCameraStatus] = useState<DeviceStatus>('idle');
  const [micStatus, setMicStatus] = useState<DeviceStatus>('idle');
  const [doctorName, setDoctorName] = useState('seu médico');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const hasWebRTC = typeof window !== 'undefined' && !!window.RTCPeerConnection;

  useEffect(() => {
    if (!id) return;
    supabase
      .from('consultations')
      .select('doctor_name')
      .eq('id', id)
      .single()
      .then(({ data }) => { if (data?.doctor_name) setDoctorName(data.doctor_name); });

    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [id]);

  const requestMedia = async () => {
    setCameraStatus('requesting');
    setMicStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraStatus('ok');
      setMicStatus('ok');
    } catch (err) {
      const name = (err as Error).name;
      const status: DeviceStatus = (name === 'NotAllowedError' || name === 'PermissionDeniedError')
        ? 'denied'
        : name === 'NotFoundError' ? 'unavailable' : 'denied';
      setCameraStatus(status);
      setMicStatus(status);
    }
  };

  const handleProceed = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    navigate(`/consulta/${id}/chamada`);
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
            Vamos verificar câmera e microfone antes de entrar com <strong>{doctorName}</strong>
          </p>
        </div>

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
          Você entrará na sala de espera virtual. O médico iniciará a chamada em breve.
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
