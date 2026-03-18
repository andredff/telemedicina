import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
  Stethoscope,
  CalendarDays,
  Clock,
  User as UserIcon,
  ArrowLeft,
  CheckCircle,
  FileText,
  Upload,
  Trash2,
  ChevronRight,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  Specialty,
  AvailableProfessional,
  AvailableScheduleDay,
  ScheduleSlot,
  AnamneseResposta,
} from "@/integrations/assemed/types";
import type { ConsultationFlowStep } from "@/hooks/useAssemedConsultation";

// ─── Constants ────────────────────────────────────────────────────────────────

const SINTOMAS_OPTIONS = [
  { id: 1, label: "Dor no corpo" },
  { id: 2, label: "Dores articulares" },
  { id: 3, label: "Dor lombar" },
  { id: 4, label: "Náuseas" },
  { id: 5, label: "Dor de garganta" },
];

type ScheduleStep =
  | "specialty"
  | "professional"
  | "sintomas"
  | "sintomaForte"
  | "exames"
  | "schedule"
  | "confirm";

interface ExamFile {
  name: string;
  base64: string;
}

interface ScheduleSpecialistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialties: Specialty[];
  availableProfessionals: AvailableProfessional[];
  availableSchedules: AvailableScheduleDay[];
  flowStep: ConsultationFlowStep;
  error: string | null;
  onSelectSpecialty: (specialty: Specialty) => void;
  onSelectProfessional: (professional: AvailableProfessional) => void;
  onConfirmSchedule: (
    specialty: Specialty,
    professional: AvailableProfessional,
    slot: ScheduleSlot,
    respostasAnamnese: AnamneseResposta[],
    exames: { arquivoBase64: string }[]
  ) => void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleSpecialistModal({
  open,
  onOpenChange,
  specialties,
  availableProfessionals,
  availableSchedules,
  flowStep,
  error,
  onSelectSpecialty,
  onSelectProfessional,
  onConfirmSchedule,
  onClose,
}: ScheduleSpecialistModalProps) {
  // Navigation
  const [currentStep, setCurrentStep] = useState<ScheduleStep>("specialty");

  // Selections
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<AvailableProfessional | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);

  // Anamnese
  const [sintomasSelecionados, setSintomasSelecionados] = useState<number[]>([]);
  const [sintomaForteId, setSintomaForteId] = useState<number | null>(null);
  const [medicamentos, setMedicamentos] = useState("");

  // Exames
  const [examFiles, setExamFiles] = useState<ExamFile[]>([]);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Reset ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setCurrentStep("specialty");
      setSelectedSpecialty(null);
      setSelectedProfessional(null);
      setSelectedDate(null);
      setSelectedSlot(null);
      setSintomasSelecionados([]);
      setSintomaForteId(null);
      setMedicamentos("");
      setExamFiles([]);
    }
  }, [open]);

  // ── Auto-advance from API flow steps ────────────────────────────────────────

  useEffect(() => {
    if (flowStep === "selecting_professional" && currentStep === "specialty") {
      setCurrentStep("professional");
    }
  }, [flowStep, currentStep]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const sintomasMarcados = SINTOMAS_OPTIONS.filter((s) =>
    sintomasSelecionados.includes(s.id)
  );

  const filteredSpecialties = specialties.filter((s) => {
    const nome = s.nome.toLowerCase();
    return !(
      (nome.includes("clínico") || nome.includes("clinico")) &&
      nome.includes("geral")
    );
  });

  const slotsForSelectedDate = selectedDate
    ? availableSchedules.find((d) => d.data === selectedDate)?.horarios || []
    : [];

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSelectSpecialty = (specialty: Specialty) => {
    setSelectedSpecialty(specialty);
    onSelectSpecialty(specialty);
  };

  const handleSelectProfessional = (professional: AvailableProfessional) => {
    setSelectedProfessional(professional);
    setSelectedDate(null);
    setSelectedSlot(null);
    onSelectProfessional(professional);
    setCurrentStep("sintomas");
  };

  const toggleSintoma = (id: number) => {
    setSintomasSelecionados((prev) => {
      const next = prev.includes(id)
        ? prev.filter((s) => s !== id)
        : [...prev, id];
      // Clear sintomaForte if it was unchecked
      if (sintomaForteId === id && prev.includes(id)) {
        setSintomaForteId(null);
      }
      return next;
    });
  };

  const handleSelectSlot = (slot: ScheduleSlot) => {
    setSelectedSlot(slot);
    setCurrentStep("confirm");
  };

  const handleConfirm = () => {
    if (!selectedSpecialty || !selectedProfessional || !selectedSlot) return;
    if (!selectedSlot.dataHora || isNaN(new Date(selectedSlot.dataHora).getTime())) return;

    // Build anamnese responses (same format as clínico geral)
    const sintomaForteLabel =
      SINTOMAS_OPTIONS.find((s) => s.id === sintomaForteId)?.label || "";

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

    onConfirmSchedule(
      selectedSpecialty,
      selectedProfessional,
      selectedSlot,
      respostasAnamnese,
      examFiles.map((f) => ({ arquivoBase64: f.base64 }))
    );
  };

  const handleBack = () => {
    switch (currentStep) {
      case "confirm":
        setCurrentStep("schedule");
        setSelectedSlot(null);
        break;
      case "schedule":
        setCurrentStep("exames");
        break;
      case "exames":
        setCurrentStep("sintomaForte");
        break;
      case "sintomaForte":
        setCurrentStep("sintomas");
        break;
      case "sintomas":
        setCurrentStep("professional");
        setSelectedProfessional(null);
        setSelectedDate(null);
        break;
      case "professional":
        setCurrentStep("specialty");
        setSelectedSpecialty(null);
        break;
    }
  };

  // ── File handlers ───────────────────────────────────────────────────────────

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

  // ── Loading logic ───────────────────────────────────────────────────────────

  const isLoading =
    flowStep === "authenticating" ||
    flowStep === "registering" ||
    flowStep === "loading_specialties" ||
    flowStep === "loading_professionals" ||
    flowStep === "loading_schedules" ||
    flowStep === "creating_consultation";

  // Don't block anamnese/exames steps while schedules load in background
  const showLoading =
    isLoading &&
    !(
      (currentStep === "sintomas" || currentStep === "sintomaForte" || currentStep === "exames") &&
      flowStep === "loading_schedules"
    );

  const schedulesStillLoading =
    currentStep === "schedule" && flowStep === "loading_schedules";

  const getLoadingMessage = () => {
    switch (flowStep) {
      case "registering":
        return "Cadastrando paciente...";
      case "authenticating":
        return "Autenticando...";
      case "loading_specialties":
        return "Carregando especialidades...";
      case "loading_professionals":
        return "Carregando profissionais disponíveis...";
      case "loading_schedules":
        return "Carregando horários disponíveis...";
      case "creating_consultation":
        return "Criando agendamento...";
      default:
        return "Carregando...";
    }
  };

  // ── Stepper ─────────────────────────────────────────────────────────────────

  const stepperSteps = [
    { label: "Especialidade", key: "specialty" },
    { label: "Profissional", key: "professional" },
    { label: "Anamnese 1/2", key: "sintomas" },
    { label: "Anamnese 2/2", key: "sintomaForte" },
    { label: "Exames", key: "exames" },
    { label: "Horário", key: "schedule" },
    { label: "Confirmar", key: "confirm" },
  ];

  const stepIndex = stepperSteps.findIndex((s) => s.key === currentStep);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Stepper — circular numbered, same as ConsultaWizardModal */}
        <div className="flex items-center gap-0 mb-2">
          {stepperSteps.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    i < stepIndex
                      ? "bg-primary border-primary text-primary-foreground"
                      : i === stepIndex
                      ? "border-primary text-primary bg-primary/10"
                      : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {i < stepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={`text-[10px] mt-0.5 text-center leading-tight ${
                    i === stepIndex
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < stepperSteps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 mb-4 transition-colors ${
                    i < stepIndex ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Loading state */}
        {showLoading && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{getLoadingMessage()}</p>
          </div>
        )}

        {/* Error */}
        {flowStep === "error" && error && (
          <div className="space-y-4 py-2">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        )}

        {/* ── Step 1: Specialty ──────────────────────────────────────────── */}
        {!showLoading &&
          flowStep !== "error" &&
          currentStep === "specialty" &&
          flowStep === "selecting_specialty" && (
          <>
            <DialogHeader>
              <DialogTitle>Selecione a especialidade</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {filteredSpecialties.length > 0 ? (
                filteredSpecialties.map((specialty) => (
                  <Card
                    key={specialty.id}
                    className="cursor-pointer transition-all hover:shadow-card hover:border-primary/20 group"
                    onClick={() => handleSelectSpecialty(specialty)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Stethoscope className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">
                          {specialty.nome}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {specialty.tipoProfissionalDescricao}
                        </p>
                      </div>
                      {specialty.triagem && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          Triagem
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Nenhuma especialidade disponível</AlertTitle>
                  <AlertDescription>
                    Não há especialidades disponíveis no momento.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </>
        )}

        {/* ── Step 2: Professional ───────────────────────────────────────── */}
        {!showLoading &&
          flowStep !== "error" &&
          currentStep === "professional" &&
          flowStep === "selecting_professional" && (
          <>
            <DialogHeader>
              <DialogTitle>Escolha o profissional</DialogTitle>
              {selectedSpecialty && (
                <DialogDescription>
                  {selectedSpecialty.nome}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {availableProfessionals.length > 0 ? (
                availableProfessionals.map((professional) => (
                  <Card
                    key={professional.profissionalId}
                    className="cursor-pointer transition-all hover:shadow-card hover:border-primary/20 group"
                    onClick={() => handleSelectProfessional(professional)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                        <UserIcon className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">
                          {professional.nome}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {professional.especialidadeNome}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Nenhum profissional disponível</AlertTitle>
                  <AlertDescription>
                    Não há profissionais disponíveis para esta especialidade no
                    momento. Tente novamente mais tarde.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 3: Sintomas (checkbox list) ───────────────────────────── */}
        {!showLoading && flowStep !== "error" && currentStep === "sintomas" && (
          <>
            <DialogHeader>
              <DialogTitle>Marque os sintomas que você tem sentido</DialogTitle>
            </DialogHeader>
            <div className="divide-y divide-border rounded-lg border overflow-hidden mt-2">
              {SINTOMAS_OPTIONS.map((s) => {
                const checked = sintomasSelecionados.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSintoma(s.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      checked ? "bg-primary/5" : ""
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        checked
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {checked && (
                        <CheckCircle className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="text-sm">{s.label}</span>
                  </button>
                );
              })}
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={handleBack}>
                Voltar
              </Button>
              <Button
                onClick={() => setCurrentStep("sintomaForte")}
                className="gap-2"
              >
                Avançar <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 4: Sintoma forte + Medicamentos ───────────────────────── */}
        {!showLoading && flowStep !== "error" && currentStep === "sintomaForte" && (
          <>
            <DialogHeader>
              <DialogTitle>Onde você sente a dor mais forte?</DialogTitle>
              {sintomasMarcados.length > 0 ? (
                <DialogDescription>
                  Selecione o sintoma mais intenso entre os que você marcou.
                </DialogDescription>
              ) : (
                <DialogDescription>
                  Você não marcou nenhum sintoma no passo anterior.
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {sintomasMarcados.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border overflow-hidden">
                  {sintomasMarcados.map((s) => {
                    const selected = sintomaForteId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSintomaForteId(s.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                          selected ? "bg-primary/5" : ""
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            selected
                              ? "border-primary"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {selected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="text-sm">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum sintoma foi selecionado anteriormente.
                </p>
              )}

              {/* Medicamentos */}
              <div className="space-y-1.5 pt-1">
                <p className="text-sm font-medium text-foreground">
                  Você toma algum medicamento?{" "}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </p>
                <Textarea
                  placeholder="Ex: Dipirona, Losartana..."
                  value={medicamentos}
                  onChange={(e) => setMedicamentos(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={handleBack}>
                Voltar
              </Button>
              <Button
                onClick={() => setCurrentStep("exames")}
                disabled={sintomasMarcados.length > 0 && !sintomaForteId}
                className="gap-2"
              >
                Avançar <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 5: Exames ─────────────────────────────────────────────── */}
        {!showLoading && flowStep !== "error" && currentStep === "exames" && (
          <>
            <DialogHeader>
              <DialogTitle>Gostaria de fornecer algum exame?</DialogTitle>
              <DialogDescription>Anexe imagens ou PDFs (opcional).</DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-3">
              {/* Drop zone */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  {isAddingFile
                    ? "Carregando..."
                    : "Clique aqui ou arraste o arquivo para esta área"}
                </p>
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
                <div className="space-y-2">
                  {examFiles.map((exame, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{exame.name}</span>
                      <button
                        type="button"
                        onClick={() => removeExame(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={handleBack}>
                Voltar
              </Button>
              <Button
                onClick={() => setCurrentStep("schedule")}
                className="gap-2"
              >
                {examFiles.length > 0
                  ? `Avançar com ${examFiles.length} arquivo${examFiles.length > 1 ? "s" : ""}`
                  : "Avançar sem anexos"}{" "}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 6: Schedule (Date & Time) ─────────────────────────────── */}
        {schedulesStillLoading && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Carregando horários disponíveis...
            </p>
          </div>
        )}

        {!showLoading &&
          !schedulesStillLoading &&
          flowStep !== "error" &&
          currentStep === "schedule" &&
          (flowStep === "selecting_schedule" || flowStep === "selecting_professional") && (
          <>
            <DialogHeader>
              <DialogTitle>Selecione a data e horário</DialogTitle>
              {selectedProfessional && (
                <DialogDescription>
                  {selectedProfessional.nome} — {selectedSpecialty?.nome}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {availableSchedules.length > 0 ? (
                <>
                  {/* Date selection */}
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Selecione a data
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {availableSchedules.map((day) => {
                        const dateObj = new Date(day.data + "T12:00:00");
                        const isSelected = selectedDate === day.data;
                        return (
                          <Button
                            key={day.data}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setSelectedDate(day.data);
                              setSelectedSlot(null);
                            }}
                            className="min-w-[100px]"
                          >
                            <div className="text-center">
                              <div className="text-xs">
                                {format(dateObj, "EEE", { locale: ptBR })}
                              </div>
                              <div className="font-semibold">
                                {format(dateObj, "dd/MM", { locale: ptBR })}
                              </div>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time slot selection */}
                  {selectedDate && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Selecione o horário
                      </p>
                      {slotsForSelectedDate.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {slotsForSelectedDate.map((slot, idx) => {
                            const time = format(new Date(slot.dataHora), "HH:mm");
                            const isSelected =
                              selectedSlot?.dataHora === slot.dataHora;
                            return (
                              <Button
                                key={idx}
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleSelectSlot(slot)}
                              >
                                {time}
                              </Button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nenhum horário disponível para esta data.
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Nenhum horário disponível</AlertTitle>
                  <AlertDescription>
                    Não há horários disponíveis para este profissional no momento.
                    Tente outro profissional ou volte mais tarde.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleBack}>
                Voltar
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 7: Confirm ────────────────────────────────────────────── */}
        {!showLoading && flowStep !== "error" && currentStep === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirme o agendamento</DialogTitle>
            </DialogHeader>

            <Card className="border-primary/20 bg-primary/5 mt-2">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Stethoscope className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground">Especialidade</p>
                      <p className="font-medium">{selectedSpecialty?.nome}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <UserIcon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground">Profissional</p>
                      <p className="font-medium">{selectedProfessional?.nome}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarDays className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground">Data e Horário</p>
                      {selectedSlot?.dataHora &&
                      !isNaN(new Date(selectedSlot.dataHora).getTime()) ? (
                        <p className="font-medium">
                          {format(
                            new Date(selectedSlot.dataHora),
                            "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                            { locale: ptBR }
                          )}
                        </p>
                      ) : (
                        <p className="text-muted-foreground italic">
                          Horário não selecionado
                        </p>
                      )}
                    </div>
                  </div>
                  {sintomasMarcados.length > 0 && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-muted-foreground">Sintomas</p>
                        <p className="font-medium">
                          {sintomasMarcados.map((s) => s.label).join(", ")}
                        </p>
                        {sintomaForteId && (
                          <p className="text-xs text-muted-foreground">
                            Mais forte:{" "}
                            {SINTOMAS_OPTIONS.find((s) => s.id === sintomaForteId)?.label}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {medicamentos.trim() && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-muted-foreground">Medicamentos</p>
                        <p className="font-medium">{medicamentos}</p>
                      </div>
                    </div>
                  )}
                  {examFiles.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Paperclip className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-muted-foreground">Exames anexados</p>
                        <p className="font-medium">
                          {examFiles.length} arquivo
                          {examFiles.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={handleBack}>
                Voltar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={
                  !selectedSpecialty ||
                  !selectedProfessional ||
                  !selectedSlot?.dataHora
                }
                className="gap-2"
              >
                <Stethoscope className="h-4 w-4" />
                Confirmar Agendamento
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
