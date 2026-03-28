import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
  Stethoscope,
  ArrowLeft,
  CheckCircle,
  FileText,
  Upload,
  Trash2,
  ChevronRight,
  Paperclip,
  Heart,
  Pill,
  Video,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type {
  Specialty,
  AnamneseResposta,
} from "@/integrations/assemed/types";
import type { ConsultationFlowStep } from "@/hooks/useAssemedConsultation";

// ─── Constants ─────────────────────────────────────────────────────────────

const SINTOMAS_OPTIONS = [
  { id: 1, label: "Dor no corpo", icon: "🤕" },
  { id: 2, label: "Dores articulares", icon: "🦴" },
  { id: 3, label: "Dor lombar", icon: "🔙" },
  { id: 4, label: "Náuseas", icon: "🤢" },
  { id: 5, label: "Dor de garganta", icon: "😮" },
];

type WizardStep = "specialty" | "saude" | "exames" | "confirmar";

interface ExamFile {
  name: string;
  base64: string;
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface ScheduleSpecialistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialties: Specialty[];
  flowStep: ConsultationFlowStep;
  error: string | null;
  onSelectSpecialty: (specialty: Specialty) => void;
  onConfirm: (
    specialty: Specialty,
    respostasAnamnese: AnamneseResposta[],
    exames: { arquivoBase64: string }[]
  ) => void;
  onClose: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Wizard step config ────────────────────────────────────────────────────

const WIZARD_STEPS: { key: WizardStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "specialty",  label: "Especialidade", icon: Stethoscope },
  { key: "saude",      label: "Saúde",         icon: Heart },
  { key: "exames",     label: "Exames",        icon: FileText },
  { key: "confirmar",  label: "Iniciar",       icon: Video },
];

// ─── Sub-components ────────────────────────────────────────────────────────

function WizardStepper({ currentStep }: { currentStep: WizardStep }) {
  const idx = WIZARD_STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-0 px-6 pt-5 pb-4 border-b border-border/50">
      {WIZARD_STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border-2 ${
                  done
                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                    : active
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border text-muted-foreground/50"
                }`}
              >
                {done ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={`text-[9px] font-medium leading-tight text-center truncate w-full ${
                  active
                    ? "text-primary"
                    : done
                    ? "text-primary/70"
                    : "text-muted-foreground/50"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={`h-0.5 w-full mx-1 mb-4 transition-all duration-300 rounded-full ${
                  i < idx ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function ScheduleSpecialistModal({
  open,
  onOpenChange,
  specialties,
  flowStep,
  error,
  onSelectSpecialty,
  onConfirm,
  onClose,
}: ScheduleSpecialistModalProps) {
  // ── Navigation ────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<WizardStep>("specialty");

  // ── Selections ────────────────────────────────────────────────────────
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);

  // ── Anamnese ──────────────────────────────────────────────────────────
  const [sintomasSelecionados, setSintomasSelecionados] = useState<number[]>([]);
  const [sintomaForteId, setSintomaForteId] = useState<number | null>(null);
  const [medicamentos, setMedicamentos] = useState("");

  // ── Exames ────────────────────────────────────────────────────────────
  const [examFiles, setExamFiles] = useState<ExamFile[]>([]);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Reset on open ─────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setCurrentStep("specialty");
      setSelectedSpecialty(null);
      setSintomasSelecionados([]);
      setSintomaForteId(null);
      setMedicamentos("");
      setExamFiles([]);
    }
  }, [open]);

  // ── Derived ───────────────────────────────────────────────────────────
  const filteredSpecialties = specialties.filter((s) => {
    const nome = s.nome.toLowerCase();
    return !((nome.includes("clínico") || nome.includes("clinico")) && nome.includes("geral"));
  });

  const sintomasMarcados = SINTOMAS_OPTIONS.filter((s) =>
    sintomasSelecionados.includes(s.id)
  );

  // ── Loading ───────────────────────────────────────────────────────────
  const isLoading =
    flowStep === "authenticating" ||
    flowStep === "registering" ||
    flowStep === "loading_specialties" ||
    flowStep === "creating_consultation";

  const getLoadingMessage = () => {
    switch (flowStep) {
      case "registering": return "Cadastrando paciente...";
      case "authenticating": return "Autenticando...";
      case "loading_specialties": return "Carregando especialidades...";
      case "creating_consultation": return "Iniciando consulta...";
      default: return "Carregando...";
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleSelectSpecialty = (specialty: Specialty) => {
    setSelectedSpecialty(specialty);
    onSelectSpecialty(specialty);
    setCurrentStep("saude");
  };

  const toggleSintoma = (id: number) => {
    setSintomasSelecionados((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      if (sintomaForteId === id && prev.includes(id)) setSintomaForteId(null);
      return next;
    });
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsAddingFile(true);
    const newExames = await Promise.all(
      files.map(async (f) => ({ name: f.name, base64: await fileToBase64(f) }))
    );
    setExamFiles((prev) => [...prev, ...newExames]);
    setIsAddingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeExame = (index: number) => {
    setExamFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (!selectedSpecialty) return;

    const sintomaForteLabel = SINTOMAS_OPTIONS.find((s) => s.id === sintomaForteId)?.label || "";
    const sintomaTexto = sintomaForteId
      ? `Sintomas mais fortes: ${sintomaForteLabel}.`
      : sintomasSelecionados.length > 0
      ? `Sintomas: ${sintomasMarcados.map((s) => s.label).join(", ")}.`
      : "Nenhum sintoma selecionado.";

    const respostasAnamnese: AnamneseResposta[] = [
      {
        perguntaQuestionarioAnamneseId: 1,
        opcoesRespondidas: sintomasSelecionados.map((id) => ({
          opcoesPerguntaQuestionarioAnamneseId: id,
        })),
        texto: sintomaTexto,
      },
      {
        perguntaQuestionarioAnamneseId: 2,
        opcoesRespondidas: [],
        texto: medicamentos.trim() || "Nenhum",
      },
    ];

    onConfirm(
      selectedSpecialty,
      respostasAnamnese,
      examFiles.map((f) => ({ arquivoBase64: f.base64 }))
    );
  };

  const handleBack = () => {
    switch (currentStep) {
      case "confirmar":
        setCurrentStep("exames");
        break;
      case "exames":
        setCurrentStep("saude");
        break;
      case "saude":
        setCurrentStep("specialty");
        setSelectedSpecialty(null);
        break;
    }
  };

  const canAdvanceFromSaude =
    sintomasMarcados.length === 0 || !!sintomaForteId;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Stepper */}
        <WizardStepper currentStep={currentStep} />

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Global loading ───────────────────────────────────────── */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{getLoadingMessage()}</p>
                <p className="text-sm text-muted-foreground mt-1">Aguarde um momento...</p>
              </div>
            </div>
          )}

          {/* ── Error ────────────────────────────────────────────────── */}
          {flowStep === "error" && error && (
            <div className="p-6 space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Não foi possível prosseguir</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button variant="outline" className="w-full" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar e tentar novamente
              </Button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* STEP 1 — Especialidade                                    */}
          {/* ══════════════════════════════════════════════════════════ */}
          {!isLoading && flowStep !== "error" && currentStep === "specialty" && flowStep === "selecting_specialty" && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">Escolha a especialidade</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione a área médica para a sua consulta
                </p>
              </div>

              {filteredSpecialties.length > 0 ? (
                <div className="space-y-2">
                  {filteredSpecialties.map((specialty) => {
                    const isIncluded = specialty.precoConsulta === 0;
                    return (
                      <button
                        key={specialty.id}
                        type="button"
                        onClick={() => handleSelectSpecialty(specialty)}
                        className="w-full group text-left"
                      >
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all duration-150">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isIncluded
                              ? "bg-primary/10 group-hover:bg-primary/20"
                              : "bg-muted group-hover:bg-muted/80"
                          }`}>
                            <Stethoscope className={`h-5 w-5 ${isIncluded ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm">{specialty.nome}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {specialty.tipoProfissionalDescricao}
                            </p>
                            {specialty.triagem && (
                              <Badge variant="outline" className="text-[10px] h-4 mt-1 px-1.5">
                                Triagem obrigatória
                              </Badge>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            {isIncluded ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                                <Sparkles className="h-3 w-3" />
                                No plano
                              </span>
                            ) : (
                              <div>
                                <p className="font-bold text-foreground text-sm">
                                  R$ {specialty.precoConsulta.toFixed(2).replace(".", ",")}
                                </p>
                                <p className="text-[10px] text-muted-foreground">por consulta</p>
                              </div>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Stethoscope className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">Nenhuma especialidade disponível</p>
                  <p className="text-sm text-muted-foreground mt-1">Tente novamente mais tarde</p>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* STEP 2 — Saúde (anamnese)                                 */}
          {/* ══════════════════════════════════════════════════════════ */}
          {!isLoading && flowStep !== "error" && currentStep === "saude" && (
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
                    const checked = sintomasSelecionados.includes(s.id);
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
                        <span className="text-base">{s.icon}</span>
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
                        onClick={() => setSintomaForteId(s.id === sintomaForteId ? null : s.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                          sintomaForteId === s.id
                            ? "bg-amber-500 border-amber-500 text-white"
                            : "bg-white border-amber-300 text-amber-800 hover:bg-amber-100"
                        }`}
                      >
                        <span>{s.icon}</span>
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
                  value={medicamentos}
                  onChange={(e) => setMedicamentos(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2 border-t border-border/50">
                <Button variant="outline" onClick={handleBack} className="flex-none">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  onClick={() => setCurrentStep("exames")}
                  disabled={!canAdvanceFromSaude}
                  className="flex-1 gap-2"
                >
                  Próximo: Exames
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* STEP 3 — Exames                                           */}
          {/* ══════════════════════════════════════════════════════════ */}
          {!isLoading && flowStep !== "error" && currentStep === "exames" && (
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
              {examFiles.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-muted-foreground font-medium">
                    {examFiles.length} arquivo{examFiles.length > 1 ? "s" : ""} selecionado{examFiles.length > 1 ? "s" : ""}
                  </p>
                  {examFiles.map((exame, i) => (
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
                <Button variant="outline" onClick={() => setCurrentStep("saude")} className="flex-none">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button onClick={() => setCurrentStep("confirmar")} className="flex-1 gap-2">
                  {examFiles.length > 0
                    ? `Avançar com ${examFiles.length} arquivo${examFiles.length > 1 ? "s" : ""}`
                    : "Avançar sem exames"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* STEP 4 — Confirmar e iniciar                              */}
          {/* ══════════════════════════════════════════════════════════ */}
          {!isLoading && flowStep !== "error" && currentStep === "confirmar" && (
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
                      <p className="font-bold text-foreground">Agendamento com Especialista</p>
                      <p className="text-xs text-muted-foreground">{selectedSpecialty?.nome} · Telemedicina Novità</p>
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
                            <span>{s.icon}</span>
                            {s.label}
                            {sintomaForteId === s.id && (
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

                  {medicamentos.trim() && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Medicamentos em uso</p>
                      <p className="text-sm text-foreground">{medicamentos}</p>
                    </div>
                  )}

                  {examFiles.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Exames anexados</p>
                      <p className="text-sm text-foreground flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5 text-primary" />
                        {examFiles.length} arquivo{examFiles.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Info box */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-5">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800">
                  Você será conectado a um <strong>Atendente disponível agora</strong>.
                  Certifique-se de ter câmera e microfone funcionando antes de iniciar.
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setCurrentStep("exames")} className="flex-none">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedSpecialty}
                  className="flex-1 gap-2 gradient-hero text-primary-foreground"
                  size="lg"
                >
                  <Video className="h-4 w-4" />
                  Iniciar Atendimento Agora
                </Button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
