import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Video,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Star,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Consultation, ConsultationStatus } from "@/integrations/assemed";

interface ConsultationCardProps {
  consultation: Consultation;
  onViewPrescription?: (consultationId: number) => void;
  onEvaluate?: (consultationId: number) => void;
  onCancel?: (consultationId: number) => void;
  onJoin?: (consultation: Consultation) => void;
}

const statusConfig: Record<
  ConsultationStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  AGUARDANDO: {
    label: "Aguardando Atendimento",
    variant: "default",
    icon: Clock,
  },
  EM_ATENDIMENTO: {
    label: "Em Atendimento",
    variant: "secondary",
    icon: Video,
  },
  CONCLUIDO: {
    label: "Concluído",
    variant: "outline",
    icon: CheckCircle,
  },
  CANCELADO: {
    label: "Cancelado",
    variant: "destructive",
    icon: XCircle,
  },
};

export function ConsultationCard({
  consultation,
  onViewPrescription,
  onEvaluate,
  onCancel,
  onJoin,
}: ConsultationCardProps) {
  const status = statusConfig[consultation.status];

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", {
        locale: ptBR,
      });
    } catch {
      return dateString;
    }
  };


  // Consulta agendada: tem dataAgendamento preenchido
  const isAgendada = !!consultation.dataAgendamento;

  // Badge: consulta agendada aguardando → "Consulta Agendada"; imediata → usa statusConfig
  const badgeConfig =
    isAgendada && consultation.status === "AGUARDANDO"
      ? { label: "Consulta Agendada", variant: "secondary" as const, icon: Calendar }
      : status;
  const BadgeIcon = badgeConfig.icon;
  const isImediata = !consultation.dataAgendamento;

  // Data/hora de exibição
  const agendamentoDate = consultation.dataAgendamento ? new Date(consultation.dataAgendamento) : null;
  const now = new Date();
  let canEnterAgendada = false;
  let showJoinButton = false;
  let dataLiberacao = null;
  if (isAgendada && agendamentoDate) {
    // Só libera se for o mesmo dia do agendamento
    const isToday = now.toDateString() === agendamentoDate.toDateString();
    dataLiberacao = new Date(agendamentoDate.getTime() - 10 * 60000);
    canEnterAgendada = isToday && now >= dataLiberacao;
    showJoinButton = (consultation.status === "AGUARDANDO" || consultation.status === "EM_ATENDIMENTO");
  } else if (isImediata) {
    showJoinButton = consultation.status === "AGUARDANDO" || consultation.status === "EM_ATENDIMENTO";
    canEnterAgendada = true;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">
                Consulta #{consultation.id}
              </CardTitle>
              {/* Mostra status textual e se está agendada */}
              {consultation.situacaoAtendimentoDescricao && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {consultation.situacaoAtendimentoDescricao.toLowerCase().includes("agend") ? "AGENDADA" : consultation.situacaoAtendimentoDescricao}
                </p>
              )}
              {/* Mostra data/hora do agendamento se existir */}
              {consultation.dataAgendamento && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Agendada para: {format(new Date(consultation.dataAgendamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
          <Badge variant={badgeConfig.variant} className="gap-1">
            <BadgeIcon className="h-3 w-3" />
            {badgeConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informações da consulta */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Especialidade</p>
            <p className="font-medium">{consultation.especialidadeId === 1 ? "Clínico Geral" : consultation.especialidadeNome}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Profissional</p>
            <p className="font-medium">
              {consultation.profissionalNome || "Aguardando..."}
            </p>
          </div>
          {/* Data/hora para consulta agendada */}
          {isAgendada && agendamentoDate && (
            <>
              <div>
                <p className="text-muted-foreground">Data do Agendamento</p>
                <p className="font-medium">{format(agendamentoDate, "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Horário da Consulta</p>
                <p className="font-medium">{format(agendamentoDate, "HH:mm", { locale: ptBR })}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Data de Liberação</p>
                <p className="font-medium">{dataLiberacao ? format(dataLiberacao, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"}</p>
              </div>
            </>
          )}
          {/* Data de criação para consulta imediata */}
          {isImediata && (
            <div>
              <p className="text-muted-foreground">Data</p>
              <p className="font-medium">{formatDate(consultation.dataHoraCriacao)}</p>
            </div>
          )}
          {consultation.dataHoraFim && (
            <div>
              <p className="text-muted-foreground">Duração</p>
              <p className="font-medium">
                {calculateDuration(
                  consultation.dataHoraInicio!,
                  consultation.dataHoraFim
                )}
              </p>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {/* Entrar na consulta (respeita regras de horário para agendada) */}
          {onJoin && showJoinButton && (
            <Button
              size="sm"
              onClick={() => onJoin(consultation)}
              className="gap-2"
              disabled={isAgendada && !canEnterAgendada}
              title={isAgendada && !canEnterAgendada ? `Acesso liberado apenas no dia do agendamento, 10 minutos antes do horário marcado (${dataLiberacao ? format(dataLiberacao, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"})` : undefined}
            >
              {isAgendada ? (
                canEnterAgendada ? (
                  <>
                    <Video className="h-4 w-4" />
                    Entrar na Consulta
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    Aguardar horário
                  </>
                )
              ) : consultation.status === "AGUARDANDO" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrar na Fila
                </>
              ) : (
                <>
                  <Video className="h-4 w-4" />
                  Entrar na Consulta
                </>
              )}
            </Button>
          )}

          {/* Cancelar */}
          {consultation.status === "AGUARDANDO" && onCancel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCancel(consultation.id)}
            >
              Cancelar
            </Button>
          )}

          {/* Ver receita */}
          {consultation.status === "CONCLUIDO" && onViewPrescription && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewPrescription(consultation.id)}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Ver Receita
            </Button>
          )}

          {/* Avaliar */}
          {consultation.status === "CONCLUIDO" && onEvaluate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEvaluate(consultation.id)}
              className="gap-2"
            >
              <Star className="h-4 w-4" />
              Avaliar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function calculateDuration(start: string, end: string): string {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} min`;
    }

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}min`;
  } catch {
    return "-";
  }
}
