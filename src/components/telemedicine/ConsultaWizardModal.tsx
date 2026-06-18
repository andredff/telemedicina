import { useState, useRef, useEffect, useCallback } from "react";
import {
  Heart,
  FileText,
  CalendarCheck,
  CheckCircle,
  ChevronRight,
  ArrowLeft,
  Upload,
  Trash2,
  Paperclip,
  Video,
  AlertCircle,
  AlertTriangle,
  Pill,
  Loader2,
  Clock,
  Activity,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TELEMED_TERM } from "@/data/telemedicineTerm";

/** Structured pre-consultation data the patient fills before starting the call. */
export interface WizardIntake {
  sintomas: string[];
  sintomaPrincipal: string | null;
  descricao: string;
  duracao: string | null;
  intensidade: number | null;
  medicamentos: string;
  alergias: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SINTOMAS_OPTIONS = [
  { id: 1, label: "Febre" },
  { id: 2, label: "Dor de cabeça" },
  { id: 3, label: "Dor no corpo" },
  { id: 4, label: "Dor de garganta" },
  { id: 5, label: "Tosse" },
  { id: 6, label: "Falta de ar" },
  { id: 7, label: "Náuseas / vômito" },
  { id: 8, label: "Diarreia" },
  { id: 9, label: "Tontura" },
  { id: 10, label: "Dores articulares" },
  { id: 11, label: "Dor lombar" },
  { id: 12, label: "Dor abdominal" },
];

const DURACAO_OPTIONS = ["Menos de 24h", "1 a 3 dias", "4 a 7 dias", "Mais de 1 semana"];

// Exam upload limits
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_PREFIXES = ["image/", "application/pdf"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function intensityColor(n: number): string {
  if (n <= 3) return "bg-green-500 border-green-500 text-white";
  if (n <= 6) return "bg-amber-500 border-amber-500 text-white";
  return "bg-red-500 border-red-500 text-white";
}

type WizardStep = "saude" | "exames" | "dispositivos" | "confirmar";

interface ExamFile {
  name: string;
  file: File;
  size: number;
}

interface WizardData {
  sintomasSelecionados: number[];
  sintomaForteId: number | null;
  descricao: string;
  duracao: string | null;
  intensidade: number | null;
  medicamentos: string;
  alergias: string;
  exames: ExamFile[];
}

interface DeviceStatus {
  camera: boolean;
  mic: boolean;
}

const WIZARD_STEPS_CONFIG: { key: WizardStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "saude",        label: "Saúde",   icon: Heart },
  { key: "exames",       label: "Exames",  icon: FileText },
  { key: "dispositivos", label: "Câmera",  icon: Video },
  { key: "confirmar",    label: "Iniciar", icon: CalendarCheck },
];

// ─── Stepper (clickable for already-visited steps) ────────────────────────────

function WizardStepper({
  currentStep,
  maxReachedIdx,
  onStepClick,
}: {
  currentStep: WizardStep;
  maxReachedIdx: number;
  onStepClick: (step: WizardStep) => void;
}) {
  const idx = WIZARD_STEPS_CONFIG.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-0 px-6 pt-5 pb-4 border-b border-border/50">
      {WIZARD_STEPS_CONFIG.map((s, i) => {
        const Icon = s.icon;
        const done = i < idx;
        const active = i === idx;
        const clickable = i <= maxReachedIdx && i !== idx;
        return (
          <div key={s.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 gap-1">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(s.key)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border-2 ${
                  done   ? "bg-primary border-primary text-primary-foreground shadow-sm"
                  : active ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border text-muted-foreground/50"
                } ${clickable ? "cursor-pointer hover:scale-105" : "cursor-default"}`}
              >
                {done ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </button>
              <span className={`text-[9px] font-medium leading-tight text-center truncate w-full ${
                active ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground/50"
              }`}>{s.label}</span>
            </div>
            {i < WIZARD_STEPS_CONFIG.length - 1 && (
              <div className={`h-0.5 w-full mx-1 mb-4 transition-all duration-300 rounded-full ${
                i < idx ? "bg-primary" : "bg-border"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Device check (camera + microphone) ───────────────────────────────────────

function DeviceCheckStep({ onStatusChange }: { onStatusChange: (s: DeviceStatus) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<"requesting" | "ready" | "error">("requesting");
  const [errorMsg, setErrorMsg] = useState("");
  const [camOk, setCamOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const hasVideo = stream.getVideoTracks().length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;
        setCamOk(hasVideo);
        setMicOk(hasAudio);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        if (hasAudio) {
          const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new Ctx();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            setLevel(Math.min(1, rms * 3));
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
        }

        setPhase("ready");
        onStatusChange({ camera: hasVideo, mic: hasAudio });
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name;
        setPhase("error");
        setErrorMsg(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Permissão de câmera/microfone negada. Você ainda pode iniciar, mas o médico pode não conseguir te ver ou ouvir."
            : name === "NotFoundError"
            ? "Nenhuma câmera ou microfone encontrado neste dispositivo."
            : "Não foi possível acessar câmera/microfone. Verifique se outro aplicativo não está usando os dispositivos."
        );
        onStatusChange({ camera: false, mic: false });
      }
    };

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [onStatusChange]);

  return (
    <div className="space-y-4">
      {/* Video preview */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-gray-900 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover -scale-x-100"
        />
        {phase === "requesting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Solicitando acesso à câmera e microfone…</p>
          </div>
        )}
        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 p-6 text-center">
            <CameraOff className="h-8 w-8" />
            <p className="text-xs">Pré-visualização indisponível</p>
          </div>
        )}
      </div>

      {/* Status rows */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`flex items-center gap-2.5 rounded-xl border p-3 ${camOk ? "border-green-200 bg-green-50" : "border-border bg-muted/30"}`}>
          {camOk ? <Camera className="h-4 w-4 text-green-600" /> : <CameraOff className="h-4 w-4 text-muted-foreground" />}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Câmera</p>
            <p className={`text-[11px] ${camOk ? "text-green-600" : "text-muted-foreground"}`}>
              {camOk ? "Funcionando" : phase === "requesting" ? "Verificando…" : "Indisponível"}
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-2.5 rounded-xl border p-3 ${micOk ? "border-green-200 bg-green-50" : "border-border bg-muted/30"}`}>
          {micOk ? <Mic className="h-4 w-4 text-green-600" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">Microfone</p>
            {micOk ? (
              <div className="mt-1 h-1.5 w-full rounded-full bg-green-100 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-[width] duration-75"
                  style={{ width: `${Math.round(level * 100)}%` }}
                />
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {phase === "requesting" ? "Verificando…" : "Indisponível"}
              </p>
            )}
          </div>
        </div>
      </div>

      {micOk && (
        <p className="text-[11px] text-muted-foreground text-center">
          Fale algo — a barra acima deve se mover quando o microfone captar sua voz.
        </p>
      )}

      {phase === "error" && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface ConsultaWizardModalProps {
  onClose: () => void;
  onSubmit: (intake: WizardIntake, exames: File[]) => void | Promise<void>;
  /** Título exibido no card de confirmação. Padrão: "Consulta Imediata" */
  titulo?: string;
  /** Subtítulo exibido no card de confirmação. Padrão: "Clínico Geral · Telemedicina Novità" */
  subtitulo?: string;
  /** Texto da info box de confirmação. Padrão: mensagem de clínico geral */
  infoTexto?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ConsultaWizardModal({
  onClose,
  onSubmit,
  titulo = "Consulta Imediata",
  subtitulo = "Clínico Geral · Telemedicina Novità",
  infoTexto,
}: ConsultaWizardModalProps) {
  const [step, setStep] = useState<WizardStep>("saude");
  const [maxReachedIdx, setMaxReachedIdx] = useState(0);
  const [data, setData] = useState<WizardData>({
    sintomasSelecionados: [],
    sintomaForteId: null,
    descricao: "",
    duracao: null,
    intensidade: null,
    medicamentos: "",
    alergias: "",
    exames: [],
  });
  const [examErrors, setExamErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showTerm, setShowTerm] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({ camera: false, mic: false });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sintomasMarcados = SINTOMAS_OPTIONS.filter((s) =>
    data.sintomasSelecionados.includes(s.id)
  );

  // Navigate to a step, tracking the furthest reached for the clickable stepper.
  const goToStep = useCallback((next: WizardStep) => {
    setStep(next);
    const nextIdx = WIZARD_STEPS_CONFIG.findIndex((s) => s.key === next);
    setMaxReachedIdx((prev) => Math.max(prev, nextIdx));
  }, []);

  const handleDeviceStatus = useCallback((s: DeviceStatus) => {
    setDeviceStatus(s);
  }, []);

  const toggleSintoma = (id: number) => {
    setData((prev) => ({
      ...prev,
      sintomasSelecionados: prev.sintomasSelecionados.includes(id)
        ? prev.sintomasSelecionados.filter((s) => s !== id)
        : [...prev.sintomasSelecionados, id],
      sintomaForteId:
        prev.sintomaForteId === id && prev.sintomasSelecionados.includes(id)
          ? null
          : prev.sintomaForteId,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const accepted: ExamFile[] = [];
    const errors: string[] = [];

    for (const f of files) {
      const typeOk = ACCEPTED_PREFIXES.some((p) => f.type.startsWith(p));
      if (!typeOk) {
        errors.push(`"${f.name}" — formato não aceito (envie imagem ou PDF).`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        errors.push(`"${f.name}" — ${formatBytes(f.size)} excede o limite de 10 MB.`);
        continue;
      }
      const dup = data.exames.some((e) => e.name === f.name && e.size === f.size);
      if (dup) {
        errors.push(`"${f.name}" — já foi adicionado.`);
        continue;
      }
      accepted.push({ name: f.name, file: f, size: f.size });
    }

    if (accepted.length) {
      setData((prev) => ({ ...prev, exames: [...prev.exames, ...accepted] }));
    }
    setExamErrors(errors);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeExame = (index: number) => {
    setData((prev) => ({ ...prev, exames: prev.exames.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const sintomaPrincipal =
      SINTOMAS_OPTIONS.find((s) => s.id === data.sintomaForteId)?.label ?? null;

    const intake: WizardIntake = {
      sintomas: sintomasMarcados.map((s) => s.label),
      sintomaPrincipal,
      descricao: data.descricao.trim(),
      duracao: data.duracao,
      intensidade: data.intensidade,
      medicamentos: data.medicamentos.trim(),
      alergias: data.alergias.trim(),
    };

    try {
      setSubmitting(true);
      await onSubmit(intake, data.exames.map((e) => e.file));
      // On success the parent navigates away and unmounts this modal.
    } catch {
      setSubmitting(false);
    }
  };

  const canAdvanceFromSaude = sintomasMarcados.length === 0 || !!data.sintomaForteId;

  const defaultInfoTexto = infoTexto ?? (
    titulo === "Consulta Imediata"
      ? "Você será conectado a um médico clínico geral disponível agora."
      : "Você será conectado a um especialista disponível agora."
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Stepper */}
        <WizardStepper currentStep={step} maxReachedIdx={maxReachedIdx} onStepClick={goToStep} />

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ══════════════════════════════════════════════════ */}
          {/* STEP 1 — Saúde                                    */}
          {/* ══════════════════════════════════════════════════ */}
          {step === "saude" && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">Como você está se sentindo?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Essas informações ajudam o médico a se preparar para o seu atendimento
                </p>
              </div>

              {/* Descrição livre da queixa */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Descreva o que está sentindo</p>
                </div>
                <Textarea
                  placeholder="Conte com suas palavras o que está acontecendo, quando começou e o que melhora ou piora…"
                  value={data.descricao}
                  onChange={(e) => setData((prev) => ({ ...prev, descricao: e.target.value }))}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              {/* Sintomas — grid de pills */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Quais sintomas você tem sentido?</p>
                  <span className="ml-auto text-[10px] font-medium text-muted-foreground border border-border rounded-full px-2 py-0.5">Opcional</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SINTOMAS_OPTIONS.map((s) => {
                    const checked = data.sintomasSelecionados.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSintoma(s.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all duration-150 ${
                          checked
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/5"
                        }`}
                      >
                        <span className="flex-1 text-xs">{s.label}</span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          checked ? "border-primary bg-primary" : "border-muted-foreground/30"
                        }`}>
                          {checked && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sintoma forte + duração + intensidade — só aparece se marcou algum */}
              {sintomasMarcados.length > 0 && (
                <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-amber-800 mb-2">
                      Qual é o sintoma mais intenso?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sintomasMarcados.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setData((prev) => ({
                            ...prev,
                            sintomaForteId: s.id === prev.sintomaForteId ? null : s.id,
                          }))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                            data.sintomaForteId === s.id
                              ? "bg-amber-500 border-amber-500 text-white"
                              : "bg-white border-amber-300 text-amber-800 hover:bg-amber-100"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duração */}
                  <div>
                    <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Há quanto tempo?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {DURACAO_OPTIONS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setData((prev) => ({ ...prev, duracao: prev.duracao === d ? null : d }))}
                          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                            data.duracao === d
                              ? "bg-amber-500 border-amber-500 text-white"
                              : "bg-white border-amber-300 text-amber-800 hover:bg-amber-100"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Intensidade 1-10 */}
                  <div>
                    <p className="text-sm font-semibold text-amber-800 mb-2">
                      Intensidade <span className="font-normal text-amber-700">(1 = leve · 10 = muito intenso)</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setData((prev) => ({ ...prev, intensidade: prev.intensidade === n ? null : n }))}
                          className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all ${
                            data.intensidade === n
                              ? intensityColor(n)
                              : "bg-white border-amber-300 text-amber-800 hover:bg-amber-100"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Medicamentos */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Pill className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Medicamentos em uso</p>
                  <span className="ml-auto text-[10px] font-medium text-muted-foreground border border-border rounded-full px-2 py-0.5">Opcional</span>
                </div>
                <Textarea
                  placeholder="Ex: Dipirona 500mg, Losartana 50mg..."
                  value={data.medicamentos}
                  onChange={(e) => setData((prev) => ({ ...prev, medicamentos: e.target.value }))}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              {/* Alergias */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Alergias conhecidas</p>
                  <span className="ml-auto text-[10px] font-medium text-muted-foreground border border-border rounded-full px-2 py-0.5">Opcional</span>
                </div>
                <Textarea
                  placeholder="Ex: Penicilina, dipirona, frutos do mar... (ou deixe em branco se não houver)"
                  value={data.alergias}
                  onChange={(e) => setData((prev) => ({ ...prev, alergias: e.target.value }))}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-border/50">
                <Button
                  onClick={() => goToStep("exames")}
                  disabled={!canAdvanceFromSaude}
                  className="gap-2"
                >
                  Próximo: Exames
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* STEP 2 — Exames                                   */}
          {/* ══════════════════════════════════════════════════ */}
          {step === "exames" && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">Anexar exames</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Compartilhe resultados de exames para agilizar o atendimento (opcional)
                </p>
              </div>

              {/* Drop zone */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary/40 hover:bg-primary/5 transition-colors mb-4"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground/70" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    Clique ou arraste os arquivos aqui
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Imagens e PDFs · até 10 MB cada · múltiplos arquivos
                  </p>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Validation errors */}
              {examErrors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                  {examErrors.map((err, i) => (
                    <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {err}
                    </p>
                  ))}
                </div>
              )}

              {/* File list */}
              {data.exames.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-muted-foreground font-medium">
                    {data.exames.length} arquivo{data.exames.length > 1 ? "s" : ""} selecionado{data.exames.length > 1 ? "s" : ""}
                  </p>
                  {data.exames.map((exame, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/40"
                    >
                      <Paperclip className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm flex-1 truncate">{exame.name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{formatBytes(exame.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeExame(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-border/50">
                <Button variant="outline" onClick={() => goToStep("saude")} className="flex-none">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button onClick={() => goToStep("dispositivos")} className="flex-1 gap-2">
                  {data.exames.length > 0
                    ? `Avançar com ${data.exames.length} arquivo${data.exames.length > 1 ? "s" : ""}`
                    : "Avançar sem exames"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* STEP 3 — Verificação de câmera e microfone        */}
          {/* ══════════════════════════════════════════════════ */}
          {step === "dispositivos" && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">Teste de câmera e microfone</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Confirme que seu vídeo e áudio estão funcionando antes de iniciar a consulta
                </p>
              </div>

              <DeviceCheckStep onStatusChange={handleDeviceStatus} />

              <div className="flex gap-3 pt-5 mt-1 border-t border-border/50">
                <Button variant="outline" onClick={() => goToStep("exames")} className="flex-none">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button onClick={() => goToStep("confirmar")} className="flex-1 gap-2">
                  Continuar
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* STEP 4 — Confirmar e iniciar                      */}
          {/* ══════════════════════════════════════════════════ */}
          {step === "confirmar" && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">Tudo pronto!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Revise as informações e inicie sua consulta
                </p>
              </div>

              {/* Card de resumo */}
              <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden mb-5">
                {/* Header */}
                <div className="bg-primary/10 px-5 py-4 border-b border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Video className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{titulo}</p>
                      <p className="text-xs text-muted-foreground">{subtitulo}</p>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Agora
                    </span>
                  </div>
                </div>

                {/* Detalhes */}
                <div className="p-5 space-y-4">
                  {data.descricao.trim() && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Queixa</p>
                      <p className="text-sm text-foreground">{data.descricao.trim()}</p>
                    </div>
                  )}

                  {sintomasMarcados.length > 0 ? (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Sintomas informados</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sintomasMarcados.map((s) => (
                          <span key={s.id} className="text-xs bg-muted px-2 py-1 rounded-full flex items-center gap-1">
                            {s.label}
                            {data.sintomaForteId === s.id && (
                              <span className="text-amber-600 font-medium">(principal)</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : !data.descricao.trim() && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Sintomas</p>
                      <p className="text-sm text-muted-foreground italic">Nenhum sintoma informado</p>
                    </div>
                  )}

                  {(data.duracao || data.intensidade) && (
                    <div className="flex flex-wrap gap-4">
                      {data.duracao && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Duração</p>
                          <p className="text-sm text-foreground">{data.duracao}</p>
                        </div>
                      )}
                      {data.intensidade && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Intensidade</p>
                          <p className="text-sm text-foreground">{data.intensidade}/10</p>
                        </div>
                      )}
                    </div>
                  )}

                  {data.medicamentos.trim() && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Medicamentos em uso</p>
                      <p className="text-sm text-foreground">{data.medicamentos}</p>
                    </div>
                  )}

                  {data.alergias.trim() && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Alergias</p>
                      <p className="text-sm text-foreground">{data.alergias}</p>
                    </div>
                  )}

                  {data.exames.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Exames anexados</p>
                      <p className="text-sm text-foreground flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5 text-primary" />
                        {data.exames.length} arquivo{data.exames.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  )}

                  {/* Status de dispositivos */}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Dispositivos</p>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 text-xs ${deviceStatus.camera ? "text-green-600" : "text-amber-600"}`}>
                        {deviceStatus.camera ? <Camera className="h-3.5 w-3.5" /> : <CameraOff className="h-3.5 w-3.5" />}
                        Câmera
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs ${deviceStatus.mic ? "text-green-600" : "text-amber-600"}`}>
                        {deviceStatus.mic ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                        Microfone
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Aviso se dispositivos não verificados */}
              {(!deviceStatus.camera || !deviceStatus.mic) && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-5">
                  <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800">
                    Câmera ou microfone não foram confirmados. Você pode iniciar mesmo assim, mas recomendamos
                    voltar à etapa de teste para evitar problemas durante a consulta.
                  </p>
                </div>
              )}

              {/* Info box */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-5">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800">{defaultInfoTexto}</p>
              </div>

              {/* Consentimento de telemedicina (obrigatório — CFM 2.314/2022) */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 mb-5 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
                    aria-describedby="consent-desc"
                  />
                  <span id="consent-desc" className="text-xs text-foreground/80 leading-relaxed">
                    Li e estou de acordo com o{" "}
                    <button
                      type="button"
                      onClick={() => setShowTerm((v) => !v)}
                      className="text-primary underline underline-offset-2 font-medium"
                    >
                      Termo de Consentimento para Telemedicina
                    </button>{" "}
                    e com a{" "}
                    <a
                      href="/privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 font-medium"
                    >
                      Política de Privacidade
                    </a>
                    . Estou ciente das características e limitações do atendimento por telemedicina.
                  </span>
                </label>
                {showTerm && (
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-border/60 bg-white p-3">
                    <p className="text-[11px] font-semibold text-foreground mb-2">{TELEMED_TERM.title}</p>
                    <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {TELEMED_TERM.text}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-2">Versão {TELEMED_TERM.version}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => goToStep("dispositivos")} className="flex-none" disabled={submitting}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !consentAccepted}
                  title={!consentAccepted ? "Aceite o termo de consentimento para continuar" : undefined}
                  className="flex-1 gap-2 gradient-hero text-primary-foreground"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparando consulta...
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4" />
                      Iniciar Consulta Agora
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
