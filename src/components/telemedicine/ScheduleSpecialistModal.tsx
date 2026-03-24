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
  Heart,
  Pill,
  CalendarCheck,
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
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  Specialty,
  AvailableProfessional,
  AvailableScheduleDay,
  ScheduleSlot,
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

type ScheduleStep =
  | "specialty"
  | "professional"
  | "anamnese"
  | "schedule"
  | "confirm";

interface ExamFile {
  name: string;
  base64: string;
}

// ─── Props ─────────────────────────────────────────────────────────────────

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

const WIZARD_STEPS: { key: ScheduleStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "specialty",    label: "Especialidade", icon: Stethoscope },
  { key: "professional", label: "Profissional",  icon: UserIcon },
  { key: "anamnese",     label: "Saúde",         icon: Heart },
  { key: "schedule",     label: "Horário",        icon: CalendarDays },
  { key: "confirm",      label: "Confirmar",      icon: CheckCircle },
];

// ─── Sub-components ────────────────────────────────────────────────────────

function WizardStepper({
  currentStep,
}: {
  currentStep: ScheduleStep;
}) {
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

/** Barra de resumo fixada no topo do body (após stepper) quando já há seleções */
function SelectionSummaryStrip({
  specialty,
  professional,
  slot,
}: {
  specialty: Specialty | null;
  professional: AvailableProfessional | null;
  slot: ScheduleSlot | null;
}) {
  if (!specialty && !professional && !slot) return null;
  return (
    <div className="bg-muted/50 border-b border-border/50 px-6 py-2 flex flex-wrap gap-x-4 gap-y-1">
      {specialty && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Stethoscope className="h-3 w-3 text-primary" />
          <span className="font-medium text-foreground">{specialty.nome}</span>
        </span>
      )}
      {professional && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <UserIcon className="h-3 w-3 text-primary" />
          <span className="font-medium text-foreground">{professional.nome}</span>
        </span>
      )}
      {slot?.dataHora && !isNaN(new Date(slot.dataHora).getTime()) && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3 text-primary" />
          <span className="font-medium text-foreground">
            {format(new Date(slot.dataHora), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </span>
        </span>
      )}
    </div>
  );
}

// ─── Mini Calendar ─────────────────────────────────────────────────────────

function MiniCalendar({
  availableDates,
  selectedDate,
  onSelectDate,
}: {
  availableDates: string[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const availableSet = new Set(availableDates);

  // Find the first available month
  const firstAvailable = availableDates.length > 0
    ? new Date(availableDates[0] + "T12:00:00")
    : new Date();

  const [viewMonth, setViewMonth] = useState(startOfMonth(firstAvailable));

  const days = eachDayOfInterval({
    start: startOfMonth(viewMonth),
    end: endOfMonth(viewMonth),
  });

  // Padding for day-of-week alignment (Mon = 0)
  const firstDayOfWeek = (viewMonth.getDay() + 6) % 7; // 0 = Mon

  const prevMonth = () => setViewMonth((m) => addMonths(m, -1));
  const nextMonth = () => setViewMonth((m) => addMonths(m, 1));

  const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="rounded-xl border border-border bg-card p-3 select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-sm font-semibold capitalize">
          {format(viewMonth, "MMMM yyyy", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Padding cells */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const isAvailable = availableSet.has(key);
          const isSelected = selectedDate === key;
          const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
          const isTodayDay = isToday(day);

          return (
            <button
              key={key}
              type="button"
              disabled={!isAvailable || isPast}
              onClick={() => isAvailable && !isPast && onSelectDate(key)}
              className={`
                relative h-8 w-full rounded-lg text-xs font-medium transition-all duration-150
                ${isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isAvailable && !isPast
                  ? "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 cursor-pointer"
                  : "text-muted-foreground/40 cursor-default"
                }
                ${isTodayDay && !isSelected ? "ring-1 ring-primary/50" : ""}
              `}
            >
              {format(day, "d")}
              {isAvailable && !isPast && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-50 border border-green-200" />
          <span className="text-[10px] text-muted-foreground">Disponível</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary" />
          <span className="text-[10px] text-muted-foreground">Selecionado</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

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
  // ── Navigation ────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<ScheduleStep>("specialty");

  // ── Selections ────────────────────────────────────────────────────────
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<AvailableProfessional | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);

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
      setSelectedProfessional(null);
      setSelectedDate(null);
      setSelectedSlot(null);
      setSintomasSelecionados([]);
      setSintomaForteId(null);
      setMedicamentos("");
      setExamFiles([]);
    }
  }, [open]);

  // ── Auto-advance when API finishes loading professionals ───────────────
  useEffect(() => {
    if (flowStep === "selecting_professional" && currentStep === "specialty") {
      setCurrentStep("professional");
    }
  }, [flowStep, currentStep]);

  // ── Derived ───────────────────────────────────────────────────────────
  const filteredSpecialties = specialties.filter((s) => {
    const nome = s.nome.toLowerCase();
    return !((nome.includes("clínico") || nome.includes("clinico")) && nome.includes("geral"));
  });

  const availableDateStrings = availableSchedules.map((d) => d.data);

  const slotsForSelectedDate = selectedDate
    ? availableSchedules.find((d) => d.data === selectedDate)?.horarios || []
    : [];

  const sintomasMarcados = SINTOMAS_OPTIONS.filter((s) =>
    sintomasSelecionados.includes(s.id)
  );

  // ── Loading ───────────────────────────────────────────────────────────
  const isLoading =
    flowStep === "authenticating" ||
    flowStep === "registering" ||
    flowStep === "loading_specialties" ||
    flowStep === "loading_professionals" ||
    flowStep === "loading_schedules" ||
    flowStep === "creating_consultation";

  const showLoading = isLoading && !(
    currentStep === "anamnese" && flowStep === "loading_schedules"
  );

  const schedulesStillLoading =
    currentStep === "schedule" && flowStep === "loading_schedules";

  const getLoadingMessage = () => {
    switch (flowStep) {
      case "registering": return "Cadastrando paciente...";
      case "authenticating": return "Autenticando...";
      case "loading_specialties": return "Carregando especialidades...";
      case "loading_professionals": return "Carregando profissionais disponíveis...";
      case "loading_schedules": return "Carregando horários disponíveis...";
      case "creating_consultation": return "Confirmando agendamento...";
      default: return "Carregando...";
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleSelectSpecialty = (specialty: Specialty) => {
    setSelectedSpecialty(specialty);
    onSelectSpecialty(specialty);
    // Don't advance yet — wait for API (auto-advance via useEffect)
  };

  const handleSelectProfessional = (professional: AvailableProfessional) => {
    setSelectedProfessional(professional);
    setSelectedDate(null);
    setSelectedSlot(null);
    onSelectProfessional(professional);
    setCurrentStep("anamnese");
  };

  const toggleSintoma = (id: number) => {
    setSintomasSelecionados((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      if (sintomaForteId === id && prev.includes(id)) setSintomaForteId(null);
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
        setCurrentStep("anamnese");
        break;
      case "anamnese":
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

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Stepper */}
        <WizardStepper currentStep={currentStep} />

        {/* Summary strip */}
        <SelectionSummaryStrip
          specialty={selectedSpecialty}
          professional={selectedProfessional}
          slot={selectedSlot}
        />

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Global loading ───────────────────────────────────────── */}
          {showLoading && (
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
          {!showLoading && flowStep !== "error" && currentStep === "specialty" && flowStep === "selecting_specialty" && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">Escolha a especialidade</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione a área médica para o seu agendamento
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
          {/* STEP 2 — Profissional                                     */}
          {/* ══════════════════════════════════════════════════════════ */}
          {!showLoading && flowStep !== "error" && currentStep === "professional" && flowStep === "selecting_professional" && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">Escolha o profissional</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedSpecialty?.nome} · Profissionais disponíveis para agendamento
                </p>
              </div>

              {availableProfessionals.length > 0 ? (
                <div className="space-y-3">
                  {availableProfessionals.map((professional, idx) => (
                    <button
                      key={professional.profissionalId}
                      type="button"
                      onClick={() => handleSelectProfessional(professional)}
                      className="w-full group text-left"
                    >
                      <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all duration-150">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center shrink-0">
                          <UserIcon className="h-6 w-6 text-primary/70" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-foreground text-sm">{professional.nome}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {professional.especialidadeNome}
                              </p>
                            </div>
                            {idx === 0 && (
                              <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] shrink-0">
                                Disponível
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-2">
                            <CalendarCheck className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">
                              Horários disponíveis para agendamento
                            </span>
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <UserIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">Nenhum profissional disponível</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Não há profissionais disponíveis para {selectedSpecialty?.nome} no momento.
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={handleBack}>
                    Escolher outra especialidade
                  </Button>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border/50">
                <Button variant="ghost" size="sm" onClick={handleBack} className="text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* STEP 3 — Anamnese (sintomas + exames unificados)          */}
          {/* ══════════════════════════════════════════════════════════ */}
          {!showLoading && flowStep !== "error" && currentStep === "anamnese" && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">Informações de saúde</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Ajude o médico a se preparar melhor para a sua consulta
                </p>
              </div>

              {/* Sintomas */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Quais sintomas você tem sentido?</p>
                  <Badge variant="outline" className="text-[10px] ml-auto">Opcional</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SINTOMAS_OPTIONS.map((s) => {
                    const checked = sintomasSelecionados.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSintoma(s.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all duration-150 text-sm ${
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
                  <Badge variant="outline" className="text-[10px] ml-auto">Opcional</Badge>
                </div>
                <Textarea
                  placeholder="Ex: Dipirona 500mg, Losartana 50mg..."
                  value={medicamentos}
                  onChange={(e) => setMedicamentos(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              {/* Exames */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Exames (opcional)</p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-muted-foreground/25 rounded-xl p-4 flex flex-col items-center gap-1.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <Upload className="h-6 w-6 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">
                    {isAddingFile ? "Carregando..." : "Anexar imagens ou PDFs de exames"}
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
                {examFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {examFiles.map((exame, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs flex-1 truncate">{exame.name}</span>
                        <button
                          type="button"
                          onClick={() => removeExame(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Loading hint */}
              {flowStep === "loading_schedules" && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mb-4">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Buscando horários disponíveis em segundo plano...
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-border/50">
                <Button variant="outline" onClick={handleBack} className="flex-none">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  onClick={() => setCurrentStep("schedule")}
                  className="flex-1 gap-2"
                  disabled={flowStep === "loading_schedules"}
                >
                  {flowStep === "loading_schedules" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Aguardando horários...
                    </>
                  ) : (
                    <>
                      Escolher horário
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* STEP 4 — Horário                                          */}
          {/* ══════════════════════════════════════════════════════════ */}
          {currentStep === "schedule" && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">Escolha data e horário</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedProfessional?.nome} · Selecione o melhor horário para você
                </p>
              </div>

              {schedulesStillLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="font-medium">Buscando horários disponíveis...</p>
                    <p className="text-sm text-muted-foreground mt-1">Isso leva apenas alguns segundos</p>
                  </div>
                </div>
              ) : availableSchedules.length > 0 ? (
                <div className="space-y-5">
                  {/* Calendar */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Selecione uma data</p>
                    </div>
                    <MiniCalendar
                      availableDates={availableDateStrings}
                      selectedDate={selectedDate}
                      onSelectDate={(date) => {
                        setSelectedDate(date);
                        setSelectedSlot(null);
                      }}
                    />
                  </div>

                  {/* Time slots */}
                  {selectedDate && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">
                          Horários disponíveis em{" "}
                          {format(new Date(selectedDate + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                      </div>

                      {slotsForSelectedDate.length > 0 ? (
                        <>
                          {/* First available highlight */}
                          {!selectedSlot && (
                            <div className="flex items-center gap-1.5 mb-2 text-xs text-green-700">
                              <Sparkles className="h-3 w-3" />
                              <span>Primeiro horário disponível: <strong>{format(new Date(slotsForSelectedDate[0].dataHora), "HH:mm")}</strong></span>
                            </div>
                          )}
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {slotsForSelectedDate.map((slot, idx) => {
                              const time = format(new Date(slot.dataHora), "HH:mm");
                              const isSelected = selectedSlot?.dataHora === slot.dataHora;
                              const isFirst = idx === 0;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleSelectSlot(slot)}
                                  className={`relative py-2 px-1 rounded-xl border-2 text-sm font-semibold transition-all duration-150 ${
                                    isSelected
                                      ? "bg-primary border-primary text-primary-foreground shadow-sm scale-105"
                                      : "bg-card border-green-200 text-green-700 hover:border-primary hover:bg-primary/10 hover:scale-105"
                                  }`}
                                >
                                  {time}
                                  {isFirst && !isSelected && (
                                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] bg-green-500 text-white px-1 rounded-full whitespace-nowrap">
                                      Mais cedo
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Nenhum horário disponível nesta data. Selecione outro dia.
                        </p>
                      )}
                    </div>
                  )}

                  {!selectedDate && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      ☝️ Selecione uma data para ver os horários disponíveis
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10">
                  <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">Sem horários disponíveis</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Não há horários para {selectedProfessional?.nome}. Tente outro profissional.
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={handleBack}>
                    Voltar e escolher outro profissional
                  </Button>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border/50">
                <Button variant="ghost" size="sm" onClick={handleBack} className="text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* STEP 5 — Confirmar                                        */}
          {/* ══════════════════════════════════════════════════════════ */}
          {!showLoading && flowStep !== "error" && currentStep === "confirm" && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">Confirme o agendamento</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Revise os detalhes antes de confirmar
                </p>
              </div>

              {/* Confirmation card */}
              <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden mb-5">
                {/* Header do card */}
                <div className="bg-primary/10 px-5 py-4 border-b border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <CalendarCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">Consulta com especialista</p>
                      <p className="text-xs text-muted-foreground">Telemedicina Novità</p>
                    </div>
                  </div>
                </div>

                {/* Detalhes */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Especialidade</p>
                      <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-primary" />
                        {selectedSpecialty?.nome}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Profissional</p>
                      <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        <UserIcon className="h-3.5 w-3.5 text-primary" />
                        {selectedProfessional?.nome}
                      </p>
                    </div>
                  </div>

                  {selectedSlot?.dataHora && !isNaN(new Date(selectedSlot.dataHora).getTime()) && (
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Data e Horário</p>
                      <p className="font-bold text-foreground capitalize">
                        {format(new Date(selectedSlot.dataHora), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      <p className="text-2xl font-black text-primary mt-0.5">
                        {format(new Date(selectedSlot.dataHora), "HH:mm")}
                      </p>
                    </div>
                  )}

                  {sintomasMarcados.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Sintomas informados</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sintomasMarcados.map((s) => (
                          <span key={s.id} className="text-xs bg-muted px-2 py-1 rounded-full">
                            {s.icon} {s.label}
                            {sintomaForteId === s.id && (
                              <span className="ml-1 text-amber-600 font-medium">(principal)</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {medicamentos.trim() && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Medicamentos</p>
                      <p className="text-sm text-foreground">{medicamentos}</p>
                    </div>
                  )}

                  {examFiles.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Exames anexados</p>
                      <p className="text-sm text-foreground flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" />
                        {examFiles.length} arquivo{examFiles.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Info de lembrança */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-5">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800">
                  Você poderá entrar na consulta <strong>10 minutos antes</strong> do horário agendado.
                  Certifique-se de ter câmera e microfone disponíveis.
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} className="flex-none">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedSpecialty || !selectedProfessional || !selectedSlot?.dataHora}
                  className="flex-1 gap-2 gradient-hero text-primary-foreground"
                  size="lg"
                >
                  <CalendarCheck className="h-4 w-4" />
                  Confirmar Agendamento
                </Button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
