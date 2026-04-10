import { useState, useEffect } from "react";
import {
  Loader2,
  AlertCircle,
  Stethoscope,
  CalendarDays,
  Clock,
  User as UserIcon,
  ArrowLeft,
  CheckCircle,
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  Specialty,
  AvailableProfessional,
  AvailableScheduleDay,
  ScheduleSlot,
} from "@/integrations/assemed/types";
import type { ConsultationFlowStep } from "@/hooks/useAssemedConsultation";

type ScheduleStep = "specialty" | "professional" | "schedule" | "confirm";

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
    slot: ScheduleSlot
  ) => void;
  onClose: () => void;
}

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
  const [currentStep, setCurrentStep] = useState<ScheduleStep>("specialty");
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<AvailableProfessional | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep("specialty");
      setSelectedSpecialty(null);
      setSelectedProfessional(null);
      setSelectedDate(null);
      setSelectedSlot(null);
    }
  }, [open]);

  // Advance steps based on flow step
  useEffect(() => {
    if (flowStep === "selecting_professional" && currentStep === "specialty") {
      setCurrentStep("professional");
    } else if (flowStep === "selecting_schedule" && currentStep === "professional") {
      setCurrentStep("schedule");
    }
  }, [flowStep, currentStep]);

  const handleSelectSpecialty = (specialty: Specialty) => {
    setSelectedSpecialty(specialty);
    onSelectSpecialty(specialty);
  };

  const handleSelectProfessional = (professional: AvailableProfessional) => {
    setSelectedProfessional(professional);
    setSelectedDate(null);
    setSelectedSlot(null);
    onSelectProfessional(professional);
  };

  const handleSelectSlot = (slot: ScheduleSlot) => {
    setSelectedSlot(slot);
    setCurrentStep("confirm");
  };

  const handleConfirm = () => {
    if (selectedSpecialty && selectedProfessional && selectedSlot) {
      onConfirmSchedule(selectedSpecialty, selectedProfessional, selectedSlot);
    }
  };

  const handleBack = () => {
    if (currentStep === "confirm") {
      setCurrentStep("schedule");
      setSelectedSlot(null);
    } else if (currentStep === "schedule") {
      setCurrentStep("professional");
      setSelectedProfessional(null);
      setSelectedDate(null);
    } else if (currentStep === "professional") {
      setCurrentStep("specialty");
      setSelectedSpecialty(null);
    }
  };

  const isLoading =
    flowStep === "authenticating" ||
    flowStep === "registering" ||
    flowStep === "loading_specialties" ||
    flowStep === "loading_professionals" ||
    flowStep === "loading_schedules" ||
    flowStep === "creating_consultation";

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

  // Filter specialties excluding general practitioner
  const filteredSpecialties = specialties.filter((s) => {
    const nome = s.nome.toLowerCase();
    return !(
      (nome.includes("clínico") || nome.includes("clinico")) &&
      nome.includes("geral")
    );
  });

  // Get slots for selected date
  const slotsForSelectedDate = selectedDate
    ? availableSchedules.find((d) => d.data === selectedDate)?.horarios || []
    : [];

  const stepIndex =
    currentStep === "specialty"
      ? 0
      : currentStep === "professional"
      ? 1
      : currentStep === "schedule"
      ? 2
      : 3;

  const steps = [
    { label: "Especialidade", icon: Stethoscope },
    { label: "Profissional", icon: UserIcon },
    { label: "Horário", icon: CalendarDays },
    { label: "Confirmar", icon: CheckCircle },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Agendar Consulta com Especialista
          </DialogTitle>
          <DialogDescription>
            {currentStep === "specialty" && "Selecione a especialidade desejada"}
            {currentStep === "professional" && "Escolha o profissional para sua consulta"}
            {currentStep === "schedule" && "Selecione a data e horário"}
            {currentStep === "confirm" && "Confirme os dados do agendamento"}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-1 mb-4">
          {steps.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = i === stepIndex;
            const isCompleted = i < stepIndex;
            return (
              <div key={s.label} className="flex items-center gap-1 flex-1">
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <StepIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 ${
                      isCompleted ? "bg-primary/40" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Loading state */}
        {isLoading && (
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

        {/* Step 1: Select Specialty */}
        {!isLoading &&
          flowStep !== "error" &&
          currentStep === "specialty" &&
          flowStep === "selecting_specialty" && (
            <div className="space-y-3 py-2">
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
          )}

        {/* Step 2: Select Professional */}
        {!isLoading &&
          flowStep !== "error" &&
          currentStep === "professional" &&
          flowStep === "selecting_professional" && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                {selectedSpecialty && (
                  <Badge variant="secondary">{selectedSpecialty.nome}</Badge>
                )}
              </div>

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
          )}

        {/* Step 3: Select Date & Time */}
        {!isLoading &&
          flowStep !== "error" &&
          currentStep === "schedule" &&
          flowStep === "selecting_schedule" && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                {selectedProfessional && (
                  <Badge variant="secondary">{selectedProfessional.nome}</Badge>
                )}
              </div>

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
                            const time = format(
                              new Date(slot.dataHora),
                              "HH:mm"
                            );
                            const isSelected =
                              selectedSlot?.dataHora ===
                              slot.dataHora;
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
          )}

        {/* Step 4: Confirm */}
        {!isLoading && flowStep !== "error" && currentStep === "confirm" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            </div>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-foreground">
                  Resumo do Agendamento
                </h3>
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
                      {selectedSlot && (
                        <p className="font-medium">
                          {format(
                            new Date(selectedSlot.dataHora),
                            "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                            { locale: ptBR }
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button className="w-full" size="lg" onClick={handleConfirm}>
              <CheckCircle className="h-5 w-5 mr-2" />
              Confirmar Agendamento
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
