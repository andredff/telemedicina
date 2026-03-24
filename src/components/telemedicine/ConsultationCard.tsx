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
  Stethoscope,
  Ban,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Consultation, ConsultationStatus } from "@/integrations/assemed";
import { normalizeConsultationStatus } from "@/integrations/assemed";

interface ConsultationCardProps {
  consultation: Consultation;
  onViewPrescription?: (consultationId: number) => void;
  onEvaluate?: (consultationId: number) => void;
  onCancel?: (consultationId: number) => void;
  onJoin?: (consultation: Consultation) => void;
  hasBeenEvaluated?: boolean;
}

export function ConsultationCard({
  consultation,
  onViewPrescription,
  onEvaluate,
  onCancel,
  onJoin,
  hasBeenEvaluated = false,
}: ConsultationCardProps) {
  const normalizedStatus = normalizeConsultationStatus(consultation);
  const isAgendada = !!consultation.dataAgendamento;
  const agendamentoDate = consultation.dataAgendamento ? new Date(consultation.dataAgendamento) : null;
  const now = new Date();
  const dataLiberacao = agendamentoDate ? new Date(agendamentoDate.getTime() - 10 * 60000) : null;
  const isToday = agendamentoDate ? now.toDateString() === agendamentoDate.toDateString() : false;
  const canEnterAgendada = isAgendada ? (isToday && !!dataLiberacao && now >= dataLiberacao) : true;

  const scheduledDateStr = agendamentoDate
    ? agendamentoDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : null;
  const scheduledTimeStr = agendamentoDate
    ? agendamentoDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;
  const releaseTimeStr = dataLiberacao
    ? dataLiberacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const especialidade = consultation.especialidadeId === 1
    ? "Clínico Geral"
    : consultation.especialidadeNome || "—";
  const doctorLabel = normalizedStatus === "CANCELADO"
    ? "Consulta cancelada"
    : consultation.profissionalNome || (normalizedStatus === "AGUARDANDO" ? "Buscando médico..." : "—");

  // ── Top bar config per state ────────────────────────────────────────────────
  let barBg: string;
  let borderColor: string;
  let iconBg: string;
  let iconColor: string;
  let barLabel: string;
  let BarIcon: React.ComponentType<{ className?: string }>;
  let hasPingDot = false;
  let hasPulseDot = false;

  if (normalizedStatus === "EM_ATENDIMENTO") {
    barBg = "bg-green-500"; borderColor = "border-green-200";
    iconBg = "bg-green-50 border border-green-200"; iconColor = "text-green-600";
    barLabel = "Em Atendimento"; BarIcon = Video; hasPulseDot = true;
  } else if (normalizedStatus === "AGUARDANDO" && isAgendada && !canEnterAgendada) {
    barBg = "bg-blue-600"; borderColor = "border-blue-200";
    iconBg = "bg-blue-50 border border-blue-200"; iconColor = "text-blue-600";
    barLabel = "Consulta Agendada"; BarIcon = Calendar;
  } else if (normalizedStatus === "AGUARDANDO") {
    barBg = "bg-gradient-to-r from-amber-500 to-orange-500"; borderColor = "border-amber-200";
    iconBg = "bg-amber-50 border border-amber-200"; iconColor = "text-amber-600";
    barLabel = isAgendada ? "Horário Liberado" : "Aguardando Atendimento"; BarIcon = Stethoscope; hasPingDot = true;
  } else if (normalizedStatus === "CONCLUIDO") {
    barBg = "bg-emerald-600"; borderColor = "border-emerald-200";
    iconBg = "bg-emerald-50 border border-emerald-200"; iconColor = "text-emerald-600";
    barLabel = "Concluída"; BarIcon = CheckCircle;
  } else {
    barBg = "bg-slate-400"; borderColor = "border-slate-200";
    iconBg = "bg-slate-50 border border-slate-200"; iconColor = "text-slate-500";
    barLabel = "Cancelada"; BarIcon = XCircle;
  }

  const showJoinButton = (normalizedStatus === "AGUARDANDO" || normalizedStatus === "EM_ATENDIMENTO")
    && (!isAgendada || canEnterAgendada);

  return (
    <div className={`rounded-2xl overflow-hidden shadow-md border ${borderColor} bg-white hover:shadow-lg transition-shadow`}>
      {/* ── Top status bar ── */}
      <div className={`${barBg} px-4 py-2.5 flex items-center gap-2`}>
        {hasPingDot && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
        )}
        {hasPulseDot && <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />}
        <BarIcon className="h-3.5 w-3.5 text-white shrink-0" />
        <span className="text-xs font-semibold text-white uppercase tracking-wide flex-1">{barLabel}</span>
        <span className="text-xs text-white/60 font-mono">#{consultation.id}</span>
      </div>

      {/* ── Body ── */}
      <div className="p-4 space-y-3">
        {/* Specialty + doctor row */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            <Stethoscope className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-gray-900 truncate">{especialidade}</p>
            <p className="text-xs text-gray-500 truncate">{doctorLabel}</p>
          </div>
        </div>

        {/* Scheduled info card — blue (waiting for time) */}
        {isAgendada && agendamentoDate && normalizedStatus === "AGUARDANDO" && !canEnterAgendada && scheduledDateStr && scheduledTimeStr && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 flex items-center gap-3">
            <div className="text-center shrink-0">
              <p className="text-[10px] text-blue-500 uppercase font-medium leading-none mb-0.5">Data</p>
              <p className="text-sm font-bold text-blue-800">{scheduledDateStr}</p>
            </div>
            <div className="w-px h-8 bg-blue-200" />
            <div className="text-center shrink-0">
              <p className="text-[10px] text-blue-500 uppercase font-medium leading-none mb-0.5">Horário</p>
              <p className="text-xl font-black text-blue-800">{scheduledTimeStr}</p>
            </div>
            {releaseTimeStr && (
              <>
                <div className="w-px h-8 bg-blue-200" />
                <div className="flex-1">
                  <p className="text-[10px] text-blue-500 uppercase font-medium leading-none mb-0.5">Acesso</p>
                  <p className="text-xs font-semibold text-blue-700">a partir das {releaseTimeStr}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Scheduled released — amber info pill */}
        {isAgendada && agendamentoDate && normalizedStatus === "AGUARDANDO" && canEnterAgendada && scheduledTimeStr && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>Agendada para <strong>{scheduledTimeStr}</strong></span>
          </div>
        )}

        {/* Date / duration row */}
        {(!isAgendada || normalizedStatus !== "AGUARDANDO") && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              {isAgendada && agendamentoDate
                ? format(agendamentoDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                : format(new Date(consultation.dataHoraCriacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
            {consultation.dataHoraFim && consultation.dataHoraInicio && (
              <span className="ml-auto font-medium text-gray-600">
                {calculateDuration(consultation.dataHoraInicio, consultation.dataHoraFim)}
              </span>
            )}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-1">
          {onJoin && showJoinButton && (
            <Button
              size="sm"
              onClick={() => onJoin(consultation)}
              className={`flex-1 gap-2 ${normalizedStatus === "EM_ATENDIMENTO" ? "bg-green-500 hover:bg-green-600 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"}`}
            >
              {normalizedStatus === "AGUARDANDO" && !isAgendada ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Entrar na Fila</>
              ) : (
                <><Video className="h-4 w-4" />Entrar na Consulta</>
              )}
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          )}

          {onCancel && (normalizedStatus === "AGUARDANDO" || normalizedStatus === "EM_ATENDIMENTO") && (
            isAgendada && !canEnterAgendada ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                onClick={() => onCancel(consultation.id)}
              >
                <Ban className="h-4 w-4" />
                Cancelar agendamento
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 px-3"
                onClick={() => onCancel(consultation.id)}
                title="Cancelar consulta"
              >
                <Ban className="h-4 w-4" />
              </Button>
            )
          )}

          {normalizedStatus === "CONCLUIDO" && onViewPrescription && (
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

          {normalizedStatus === "CONCLUIDO" && onEvaluate && (
            <Button
              size="sm"
              variant={hasBeenEvaluated ? "ghost" : "outline"}
              onClick={() => !hasBeenEvaluated && onEvaluate(consultation.id)}
              disabled={hasBeenEvaluated}
              className="gap-2"
            >
              <Star className={`h-4 w-4 ${hasBeenEvaluated ? "fill-amber-400 text-amber-400" : ""}`} />
              {hasBeenEvaluated ? "Avaliada" : "Avaliar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function calculateDuration(start: string, end: string): string {
  try {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  } catch {
    return "—";
  }
}
