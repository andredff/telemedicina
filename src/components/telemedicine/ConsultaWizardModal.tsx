import { useState, useRef } from "react";
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
  Pill,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/** Structured pre-consultation data the patient fills before starting the call. */
export interface WizardIntake {
  sintomas: string[];
  sintomaPrincipal: string | null;
  medicamentos: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SINTOMAS_OPTIONS = [
  { id: 1, label: "Dor no corpo" },
  { id: 2, label: "Dores articulares" },
  { id: 3, label: "Dor lombar" },
  { id: 4, label: "Náuseas" },
  { id: 5, label: "Dor de garganta" },
];

type WizardStep = "saude" | "exames" | "confirmar";

interface WizardData {
  sintomasSelecionados: number[];
  sintomaForteId: number | null;
  medicamentos: string;
  exames: { name: string; file: File }[];
}

const WIZARD_STEPS_CONFIG: { key: WizardStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "saude",     label: "Saúde",   icon: Heart },
  { key: "exames",    label: "Exames",  icon: FileText },
  { key: "confirmar", label: "Iniciar", icon: CalendarCheck },
];

// ─── Stepper ────────────────────────────────────────────────────────────────

function WizardStepper({ currentStep }: { currentStep: WizardStep }) {
  const idx = WIZARD_STEPS_CONFIG.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-0 px-6 pt-5 pb-4 border-b border-border/50">
      {WIZARD_STEPS_CONFIG.map((s, i) => {
        const Icon = s.icon;
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border-2 ${
                done   ? "bg-primary border-primary text-primary-foreground shadow-sm"
                : active ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-border text-muted-foreground/50"
              }`}>
                {done ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
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
  const [data, setData] = useState<WizardData>({
    sintomasSelecionados: [],
    sintomaForteId: null,
    medicamentos: "",
    exames: [],
  });
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sintomasMarcados = SINTOMAS_OPTIONS.filter((s) =>
    data.sintomasSelecionados.includes(s.id)
  );

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
    setIsAddingFile(true);
    const newExames = files.map((f) => ({ name: f.name, file: f }));
    setData((prev) => ({ ...prev, exames: [...prev.exames, ...newExames] }));
    setIsAddingFile(false);
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
      medicamentos: data.medicamentos.trim(),
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
      ? "Você será conectado a um médico clínico geral disponível agora. Certifique-se de ter câmera e microfone funcionando antes de iniciar."
      : "Você será conectado a um especialista disponível agora. Certifique-se de ter câmera e microfone funcionando antes de iniciar."
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Stepper */}
        <WizardStepper currentStep={step} />

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

              {/* Sintoma forte — só aparece se marcou algum */}
              {sintomasMarcados.length > 0 && (
                <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm font-semibold text-amber-800 mb-3">
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

              <div className="flex justify-end pt-2 border-t border-border/50">
                <Button
                  onClick={() => setStep("exames")}
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
                    {isAddingFile ? "Carregando arquivos..." : "Clique ou arraste os arquivos aqui"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Imagens e PDFs aceitos · Múltiplos arquivos
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
                <Button variant="outline" onClick={() => setStep("saude")} className="flex-none">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button onClick={() => setStep("confirmar")} className="flex-1 gap-2">
                  {data.exames.length > 0
                    ? `Avançar com ${data.exames.length} arquivo${data.exames.length > 1 ? "s" : ""}`
                    : "Avançar sem exames"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* STEP 3 — Confirmar e iniciar                      */}
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
                  ) : (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Sintomas</p>
                      <p className="text-sm text-muted-foreground italic">Nenhum sintoma informado</p>
                    </div>
                  )}

                  {data.medicamentos.trim() && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Medicamentos em uso</p>
                      <p className="text-sm text-foreground">{data.medicamentos}</p>
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
                </div>
              </div>

              {/* Info box */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-5">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800">{defaultInfoTexto}</p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("exames")} className="flex-none" disabled={submitting}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
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
