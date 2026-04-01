import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Video,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Stethoscope,
  X,
  FileText,
  Star,
  Plus,
  RefreshCw,
  User as UserIcon,
  Calendar,
  Ban,
  ChevronRight,
} from "lucide-react";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAssemedConsultation } from "@/hooks/useAssemedConsultation";
import { useSubscription } from "@/hooks/useSubscription";
import { ConsultaWizardModal } from "@/components/telemedicine/ConsultaWizardModal";
import PageHeader from "@/components/PageHeader";
import type { Consultation, Specialty, ConsultationStatus, AnamneseResposta } from "@/integrations/assemed/types";
import { normalizeConsultationStatus, normalizeSimplifiedStatus } from "@/integrations/assemed/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
  full_name: string;
  cpf: string;
  email: string;
  phone: string;
  birth_date: string;
  gender: "M" | "F";
}

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<
  ConsultationStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
  }
> = {
  AGUARDANDO: {
    label: "Aguardando Atendimento",
    variant: "default",
    icon: Clock,
    bgColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  EM_ATENDIMENTO: {
    label: "Em Atendimento",
    variant: "secondary",
    icon: Video,
    bgColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  CONCLUIDO: {
    label: "Concluído",
    variant: "outline",
    icon: CheckCircle,
    bgColor: "bg-green-50 text-green-700 border-green-200",
  },
  CANCELADO: {
    label: "Cancelado",
    variant: "destructive",
    icon: XCircle,
    bgColor: "bg-red-50 text-red-700 border-red-200",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateString: string) {
  try {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", {
      locale: ptBR,
    });
  } catch {
    return dateString;
  }
}

function getIsSandbox() {
  return import.meta.env.VITE_ASSEMED_SANDBOX === "true" || import.meta.env.DEV;
}

function buildConsultationUrl(atendimentoId: number, pacienteToken: string) {
  const isSandbox = getIsSandbox();
  const base = isSandbox
    ? "https://dev-app-assemed.azurewebsites.net"
    : "https://app.assemedtelemedicina.com";
  return `${base}/sala-espera-externa/${atendimentoId}?token=${encodeURIComponent(pacienteToken)}`;
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

// ─── Consultation History Card ────────────────────────────────────────────────

function ConsultationHistoryCard({
  consultation,
  onJoin,
  onCancel,
  joiningLoading,
}: {
  consultation: Consultation;
  onJoin: (c: Consultation) => void;
  onCancel: (id: number) => void;
  joiningLoading?: boolean;
}) {
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

  const especialidade = consultation.especialidadeNome || "—";
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
            <span>{isAgendada && agendamentoDate
              ? format(agendamentoDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
              : formatDate(consultation.dataCriacao || consultation.dataHoraCriacao)
            }</span>
            {consultation.dataHoraFim && consultation.dataHoraInicio && (
              <span className="ml-auto font-medium text-gray-600">
                {calculateDuration(consultation.dataHoraInicio, consultation.dataHoraFim)}
              </span>
            )}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-1">
          {showJoinButton && (
            <Button
              size="sm"
              disabled={joiningLoading}
              onClick={() => onJoin(consultation)}
              className={`flex-1 gap-2 ${normalizedStatus === "EM_ATENDIMENTO" ? "bg-green-500 hover:bg-green-600 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"}`}
            >
              {joiningLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Conectando...</>
              ) : isAgendada && normalizedStatus === "AGUARDANDO" ? (
                <><Video className="h-4 w-4" />Iniciar Consulta</>
              ) : normalizedStatus === "AGUARDANDO" ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Entrar na Fila</>
              ) : (
                <><Video className="h-4 w-4" />Entrar na Consulta</>
              )}
              {!joiningLoading && <ChevronRight className="h-4 w-4 ml-auto" />}
            </Button>
          )}

          {(normalizedStatus === "AGUARDANDO" || normalizedStatus === "EM_ATENDIMENTO") && (
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

          {normalizedStatus === "CONCLUIDO" && (
            <Button size="sm" variant="outline" className="gap-2" disabled>
              <FileText className="h-4 w-4" />
              Ver Receita
            </Button>
          )}
          {normalizedStatus === "CONCLUIDO" && (
            <Button size="sm" variant="ghost" className="gap-2" disabled>
              <Star className="h-4 w-4" />
              Avaliar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Specialty Selection Card ─────────────────────────────────────────────────

function SpecialtySelectionCard({
  specialty,
  onSelect,
  isLoading,
}: {
  specialty: Specialty;
  onSelect: (s: Specialty) => void;
  isLoading: boolean;
}) {
  const isIncluded = specialty.precoConsulta === 0;

  return (
    <Card
      className={`bg-card border-border/50 transition-all ${
        isLoading
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-card hover:border-primary/20 cursor-pointer group"
      }`}
      onClick={() => !isLoading && onSelect(specialty)}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
            isIncluded
              ? "bg-primary/10 group-hover:bg-primary/20"
              : "bg-accent/10 group-hover:bg-accent/20"
          }`}
        >
          <Stethoscope
            className={`h-6 w-6 ${isIncluded ? "text-primary" : "text-accent"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{specialty.nome}</p>
          <p className="text-sm text-muted-foreground">
            {specialty.tipoProfissionalDescricao}
          </p>
          {specialty.triagem && (
            <Badge variant="outline" className="text-xs mt-1">
              Triagem
            </Badge>
          )}
        </div>
        <div className="text-right shrink-0">
          {isIncluded ? (
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary text-xs"
            >
              No plano
            </Badge>
          ) : (
            <div>
              <p className="font-bold text-foreground text-sm">
                R$ {specialty.precoConsulta.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-muted-foreground">por consulta</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Iframe Consultation View ─────────────────────────────────────────────────

function ConsultationIframe({
  atendimentoId,
  pacienteToken,
  especialidade,
  onClose,
}: {
  atendimentoId: number;
  pacienteToken: string;
  especialidade: string;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isSandbox = getIsSandbox();

  const safeToken = pacienteToken || "";
  const iframePageUrl = `https://telemedicina.novitahomecare.com.br/?atendimentoId=${atendimentoId}&token=${encodeURIComponent(
    safeToken
  )}&especialidade=${encodeURIComponent(especialidade)}&sandbox=${isSandbox}&tipo=especialista`;

  const consultationUrl = buildConsultationUrl(atendimentoId, safeToken);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "IFRAME_READY") {
        setIsLoading(false);
      }
      if (event.data?.type === "CONSULTATION_CLOSED") {
        onClose();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">
              Teleconsulta Novità
            </p>
            <p className="text-xs text-muted-foreground">{especialidade}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* link to open in new tab removed per UI change */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Fechar consulta"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Iframe */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">
              Carregando sala de espera...
            </p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={iframePageUrl}
          title="Teleconsulta Novità"
          className="w-full h-full border-0"
          allow="camera; microphone; fullscreen; display-capture"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Especialistas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [hasLoadedConsultations, setHasLoadedConsultations] = useState(false);
  const [joiningLoading, setJoiningLoading] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showStandaloneModal, setShowStandaloneModal] = useState(false);
  const pendingAnamneseRef = useRef<{ respostasAnamnese: AnamneseResposta[]; exames: { arquivoBase64: string }[] } | null>(null);
  const [selectedSpecialtyName, setSelectedSpecialtyName] = useState<string>("");
  const [pendingCreditId, setPendingCreditId] = useState<string | null>(null);
  const [isUsingPlanConsultation, setIsUsingPlanConsultation] = useState(false);
  const [consultaFilter, setConsultaFilter] = useState<"todos" | "AGUARDANDO" | "EM_ATENDIMENTO" | "CONCLUIDO" | "CANCELADO">("todos");
  const [activeConsultationCreditId, setActiveConsultationCreditId] = useState<string | null>(null); // Crédito usado na consulta ativa atual
  const [creditsInUse, setCreditsInUse] = useState(0); // Créditos em uso por consultas ativas
  const [availableCredits, setAvailableCredits] = useState<{
    id: string;
    type: string;
    amount: number;
    expires_at: string;
  }[]>([]);

  // IDs de créditos em uso (carregados do banco)
  const [usedCreditIds, setUsedCreditIds] = useState<string[]>([]);

  const { 
    isActive: hasActivePlan,
    plan,
    hasSpecialistConsultationsAvailable,
    specialistConsultationsUsed,
    specialistConsultationsLimit,
    specialistConsultationsRemaining,
    incrementSpecialistConsultations,
    decrementSpecialistConsultations,
  } = useSubscription();

  const { accessToken: bannerAccessToken } = useAssemedToken();

  const {
    step,
    accessToken,
    specialties,
    activeConsultation,
    consultations,
    isLoadingConsultations,
    error,
    silentAuthenticate,
    startConsultationFlow,
    createSpecialistConsultation,
    loadConsultations,
    joinScheduledConsultation,
    cancelConsultation,
    resetFlow,
  } = useAssemedConsultation();

  // Filter consultations:
  //  1. dataAgendamento must be non-null (regra de negócio: só exibir consultas agendadas)
  //  2. Exclude "Clínico Geral" (only show specialist consultations)
  // Memoized to keep a stable reference — used as dependency of loadCreditsInUse / restoreOrphanCredits.
  const specialistConsultations = useMemo(() =>
    consultations.filter((c) => {
      if (!c.dataAgendamento) return false;
      const nome = (c.especialidadeNome || "").toLowerCase();
      return !(nome.includes("clínico") || nome.includes("clinico")) || !nome.includes("geral");
    }),
    [consultations]
  );

const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();

      const { data: userData } = await supabase.auth.getUser();
      const metadata = userData.user?.user_metadata;
      const identity = userData.user?.identities?.[0];
      const identityCpf = identity?.identity_data?.cpf as string | undefined;
      const cpf = (metadata?.cpf as string | undefined) || identityCpf || "";

      setProfile({
        full_name: data?.full_name || (metadata?.full_name as string) || "",
        email: data?.email || userData.user?.email || "",
        cpf,
        phone: (metadata?.phone as string) || "",
        birth_date: (metadata?.birth_date as string) || "",
        gender: (metadata?.gender as "M" | "F") || "M",
      });
    } catch (err) {
      logger.error("Erro ao buscar perfil:", err);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        } else if (session.user) {
          fetchProfile(session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else if (session.user) {
        fetchProfile(session.user.id);
      }
      setPageLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, fetchProfile]);

  // Auto-authenticate when profile is ready to load existing consultations
  useEffect(() => {
    if (!profile || hasLoadedConsultations || pageLoading) return;

    const cpf = profile.cpf.replace(/\D/g, "");
    if (cpf.length !== 11 || !profile.email) return;

    setHasLoadedConsultations(true);

    silentAuthenticate(cpf, profile).then((token) => {
      if (token) {
        loadConsultations();
      }
    });
  }, [profile, hasLoadedConsultations, pageLoading, silentAuthenticate, loadConsultations]);

  // Also load consultations when access token becomes available
  useEffect(() => {
    if (accessToken && hasLoadedConsultations) {
      loadConsultations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ── Polling para atualizar status de consultas ativas usando endpoint simplificado ──
  // Usa refs para evitar re-execução do effect quando consultations muda
  const consultationsRef = useRef(specialistConsultations);
  // Rastreia consultas para as quais já navegamos (evita navegar mais de uma vez)
  const navigatedToConsultationRef = useRef<Set<number>>(new Set());
  // Ref para sempre ter o accessToken mais recente dentro do polling (evita closure stale)
  const accessTokenRef = useRef<string | null>(accessToken);

  // Mantém refs atualizados
  useEffect(() => {
    consultationsRef.current = specialistConsultations;
  }, [specialistConsultations]);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  // Carrega créditos disponíveis ao carregar a página
  const loadAvailableCredits = useCallback(async () => {
    if (!user) return;
    
    // Usa any porque a tabela consultation_credits ainda não está nos tipos gerados
    const { data, error } = await (supabase as any)
      .from("consultation_credits")
      .select("id, type, amount, expires_at, consultation_id")
      .eq("user_id", user.id)
      .eq("status", "available")
      .eq("type", "especialista") // Apenas créditos de especialista
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (!error && data) {
      setAvailableCredits(data);
    }
  }, [user]);

  // Refs para evitar loop: loadCreditsInUse e restoreOrphanCredits leem e escrevem esses valores,
  // então não podem ser deps do useCallback sem causar re-criação infinita.
  const pendingCreditIdRef = useRef(pendingCreditId);
  pendingCreditIdRef.current = pendingCreditId;
  const activeConsultationCreditIdRef = useRef(activeConsultationCreditId);
  activeConsultationCreditIdRef.current = activeConsultationCreditId;

  // Restaura créditos órfãos (marcados como "used" mas sem consulta ativa)
  const restoreOrphanCredits = useCallback(async () => {
    if (!user) return;
    
    // Busca créditos que estão como "used" para este usuário
    const { data: usedCredits, error: fetchError } = await (supabase as any)
      .from("consultation_credits")
      .select("id, consultation_id, used_at")
      .eq("user_id", user.id)
      .eq("status", "used")
      .eq("type", "especialista");
    
    if (fetchError || !usedCredits || usedCredits.length === 0) return;
    
    // Para cada crédito usado, verifica se a consulta ainda está ativa
    for (const credit of usedCredits) {
      // Nunca restaura créditos que estamos ativamente usando nesta sessão
      if (credit.id === pendingCreditIdRef.current || credit.id === activeConsultationCreditIdRef.current) {
        logger.info(`Crédito ${credit.id} está em uso na sessão atual, não restaurar`);
        continue;
      }
      
      if (!credit.consultation_id) {
        // Crédito sem consultation_id - pode ser que ainda esteja sendo associado
        // Só restaura se foi marcado como "used" há mais de 5 minutos
        const usedAt = credit.used_at ? new Date(credit.used_at) : null;
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (!usedAt || usedAt > fiveMinutesAgo) {
          // Crédito foi marcado como usado recentemente, pode estar sendo associado ainda
          logger.info(`Crédito ${credit.id} sem consultation_id mas recente, aguardando...`);
          continue;
        }
        
        // Crédito sem consultation_id há mais de 5 minutos - restaura
        await (supabase as any)
          .from("consultation_credits")
          .update({ status: "available", used_at: null })
          .eq("id", credit.id);
        logger.info(`Crédito órfão ${credit.id} restaurado (sem consultation_id por mais de 5 min)`);
        continue;
      }
      
      // Verifica se a consulta ainda está ativa localmente
      // Converte para string para garantir comparação correta (c.id é number, credit.consultation_id pode ser string)
      const consultationIdStr = String(credit.consultation_id);
      const isActiveLocally = specialistConsultations.some(
        c => String(c.id) === consultationIdStr && 
        (normalizeConsultationStatus(c) === "AGUARDANDO" || normalizeConsultationStatus(c) === "EM_ATENDIMENTO")
      );
      
      if (!isActiveLocally) {
        // Só restaura se realmente não há consultas ativas com este ID
        // Também verifica se as consultas já foram carregadas
        if (specialistConsultations.length === 0) {
          logger.info(`Crédito ${credit.id} não restaurado - consultas ainda não carregadas`);
          continue;
        }
        
        // NÃO restaura créditos usados recentemente (últimos 30 minutos)
        // A consulta pode ter acabado de ser criada e ainda não estar na lista local
        const usedAt = credit.used_at ? new Date(credit.used_at) : null;
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        if (usedAt && usedAt > thirtyMinutesAgo) {
          logger.info(`Crédito ${credit.id} não restaurado - usado recentemente (${usedAt.toISOString()})`);
          continue;
        }
        
        await (supabase as any)
          .from("consultation_credits")
          .update({ status: "available", consultation_id: null, used_at: null })
          .eq("id", credit.id);
        logger.info(`Crédito órfão ${credit.id} restaurado (consulta ${credit.consultation_id} não está ativa)`);
      }
    }
    
    // Recarrega créditos após restaurar
    loadAvailableCredits();
  }, [user, specialistConsultations, loadAvailableCredits]);


  // Carrega créditos quando o usuário é definido, mas só se não houver créditos já carregados
  useEffect(() => {
    if (user && availableCredits.length === 0) {
      loadAvailableCredits();
    }
  }, [user, availableCredits.length, loadAvailableCredits]);


  // Restaura créditos órfãos quando as consultas são carregadas (apenas uma vez por usuário)
  const hasRestoredOrphans = useRef<string | null>(null);
  useEffect(() => {
    if (!isLoadingConsultations && user && hasRestoredOrphans.current !== user.id) {
      hasRestoredOrphans.current = user.id;
      restoreOrphanCredits();
    }
  }, [isLoadingConsultations, user, restoreOrphanCredits]);


  // Recarrega créditos quando abre o modal, mas só se o modal abrir e não estiver carregando
  useEffect(() => {
    if (showStandaloneModal && !isLoadingConsultations) {
      loadAvailableCredits();
    }
  }, [showStandaloneModal, isLoadingConsultations, loadAvailableCredits]);

  // Carrega créditos em uso (para consultas ativas) e sincroniza activeConsultationCreditId
  const loadCreditsInUse = useCallback(async () => {
    if (!user) {
      setCreditsInUse(0);
      setUsedCreditIds([]);
      if (!pendingCreditIdRef.current) {
        setActiveConsultationCreditId(null);
      }
      return;
    }

    // Obtém IDs das consultas ativas (AGUARDANDO ou EM_ATENDIMENTO)
    const activeConsultationIds = specialistConsultations
      .filter(c => {
        const status = normalizeConsultationStatus(c);
        return status === "AGUARDANDO" || status === "EM_ATENDIMENTO";
      })
      .map(c => String(c.id));

    // Busca TODOS os créditos "used" do usuário
    const { data: allUsedCredits, error: fetchError } = await (supabase as any)
      .from("consultation_credits")
      .select("id, consultation_id, used_at")
      .eq("user_id", user.id)
      .eq("status", "used")
      .eq("type", "especialista");

    if (fetchError) {
      logger.error("Erro ao buscar créditos usados:", fetchError);
      return;
    }

    // CORREÇÃO: Busca créditos que foram restaurados indevidamente
    // (status = 'available' mas com consultation_id de uma consulta ativa)
    if (activeConsultationIds.length > 0) {
      const { data: wronglyAvailableCredits } = await (supabase as any)
        .from("consultation_credits")
        .select("id, consultation_id")
        .eq("user_id", user.id)
        .eq("status", "available")
        .eq("type", "especialista")
        .not("consultation_id", "is", null);

      if (wronglyAvailableCredits && wronglyAvailableCredits.length > 0) {
        for (const credit of wronglyAvailableCredits) {
          if (activeConsultationIds.includes(String(credit.consultation_id))) {
            // Re-marca como "used" pois a consulta ainda está ativa
            logger.info(`Crédito ${credit.id} remarcado como "used" - consulta ${credit.consultation_id} ainda ativa`);
            await (supabase as any)
              .from("consultation_credits")
              .update({ status: "used", used_at: new Date().toISOString() })
              .eq("id", credit.id);
          }
        }
      }
    }

    // Filtra créditos que estão ativamente em uso:
    // 1. Créditos com consultation_id de uma consulta ativa
    // 2. Créditos recém-marcados como "used" (últimos 5 minutos) sem consultation_id
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const activeCredits = (allUsedCredits || []).filter((credit: { id: string; consultation_id: string | number | null; used_at: string | null }) => {
      // Se o crédito está associado a uma consulta ativa, está em uso
      // Converte para string para comparação correta
      if (credit.consultation_id && activeConsultationIds.includes(String(credit.consultation_id))) {
        return true;
      }
      // Se o crédito foi marcado como "used" recentemente e não tem consultation_id, também está em uso
      // (pode estar no processo de ser associado a uma nova consulta)
      if (!credit.consultation_id && credit.used_at) {
        const usedAt = new Date(credit.used_at);
        return usedAt > fiveMinutesAgo;
      }
      return false;
    });

    const ids = activeCredits.map((d: { id: string }) => d.id);
    setCreditsInUse(activeCredits.length);
    setUsedCreditIds(ids);

    // Se encontrou crédito em uso e não temos activeConsultationCreditId setado, seta agora
    if (ids.length > 0 && !activeConsultationCreditIdRef.current && !pendingCreditIdRef.current) {
      setActiveConsultationCreditId(ids[0]);
    } else if (ids.length === 0 && !pendingCreditIdRef.current) {
      setActiveConsultationCreditId(null);
    }

    // Recarrega créditos disponíveis após correções, mas só se realmente houve alteração
    if (activeConsultationIds.length > 0 && allUsedCredits && allUsedCredits.length !== activeCredits.length) {
      loadAvailableCredits();
    }
  }, [user, specialistConsultations, loadAvailableCredits]);


  // Atualiza créditos em uso quando consultas mudam, mas só se houver consultas carregadas
  useEffect(() => {
    if (!isLoadingConsultations) {
      loadCreditsInUse();
    }
  }, [isLoadingConsultations, loadCreditsInUse]);

  // Calcula créditos efetivamente disponíveis (exclui pendentes e em uso na consulta ativa)
  const effectiveAvailableCredits = useMemo(() => {
    // Filtra o crédito pendente E o crédito da consulta ativa E créditos já em uso (do banco)
    const filtered = availableCredits.filter(c => 
      c.id !== pendingCreditId && 
      c.id !== activeConsultationCreditId &&
      !usedCreditIds.includes(c.id)
    );
    return filtered;
  }, [availableCredits, pendingCreditId, activeConsultationCreditId, usedCreditIds]);

  // Associa o consultation_id ao crédito e navega para sala de espera
  // (comportamento idêntico ao Teleconsultas.tsx)
  useEffect(() => {
    const handleConsultationCreated = async () => {
      if (!activeConsultation || !activeConsultation.id) return;

      // Se tem crédito pendente, associa PRIMEIRO antes de navegar
      if (pendingCreditId) {
        const { error } = await (supabase as any)
          .from("consultation_credits")
          .update({
            consultation_id: activeConsultation.id,
          })
          .eq("id", pendingCreditId);

        if (error) {
          logger.error("Error associating credit to consultation:", error);
        } else {
          logger.info(`Crédito ${pendingCreditId} associado à consulta ${activeConsultation.id}`);
        }
        setPendingCreditId(null);
      }

      // Navega para sala de espera — sem especialidade (será definida pelo atendente)
      navigate(`/sala-espera/${activeConsultation.id}?origem=especialistas`);
    };
    handleConsultationCreated();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConsultation]);

  // ── Polling para atualizar status de consultas ativas ──
  useEffect(() => {
    if (!accessToken) return;

    // Aguarda ter consultations carregadas
    const getActiveConsultationIds = () => {
      return consultationsRef.current
        .filter((c) => {
          const status = normalizeConsultationStatus(c);
          return status === "AGUARDANDO" || status === "EM_ATENDIMENTO";
        })
        .map((c) => c.id);
    };

    const pollActiveConsultations = async () => {
      const activeIds = getActiveConsultationIds();
      if (activeIds.length === 0) return;

      try {
        const { assemedClient } = await import("@/integrations/assemed/client");
        assemedClient.setAccessToken(accessToken);
        
        for (const consultationId of activeIds) {
          try {
            const response = await assemedClient.getConsultationStatus(consultationId);
            const normalizedStatus = normalizeSimplifiedStatus(response);
            logger.info(`[Especialistas] Status consulta ${consultationId}:`, response.situacao, '-> normalizado:', normalizedStatus);
            
            // Encontra a consulta atual no ref
            const currentConsultation = consultationsRef.current.find(c => c.id === consultationId);
            if (!currentConsultation) continue;
            
            const currentStatus = normalizeConsultationStatus(currentConsultation);
            
            // Navega para sala de espera quando EM_ATENDIMENTO (igual ao fluxo de teleconsulta imediata)
            if (normalizedStatus === "EM_ATENDIMENTO" && !navigatedToConsultationRef.current.has(consultationId)) {
              navigatedToConsultationRef.current.add(consultationId);
              toast({
                title: "Médico Disponível",
                description: `${response.profissionalNome || "O médico"} está pronto para atendê-lo. Entrando na consulta...`,
              });
              // Busca dados completos (incluindo pacienteToken) antes de navegar
              try {
                const fullConsultation = await assemedClient.getConsultation(consultationId);
                const token = fullConsultation?.pacienteToken;
                if (token) {
                  navigate(`/sala-espera/${consultationId}?origem=especialistas&token=${encodeURIComponent(token)}`);
                } else {
                  navigate(`/sala-espera/${consultationId}?origem=especialistas`);
                }
              } catch {
                navigate(`/sala-espera/${consultationId}?origem=especialistas`);
              }
            }

            // Verifica se houve mudança de status
            if (normalizedStatus !== currentStatus ||
                response.profissionalNome !== currentConsultation.profissionalNome) {

              // Atualiza a consulta localmente sem chamar /obter novamente
              const updatedConsultations = consultationsRef.current.map(c =>
                c.id === consultationId
                  ? { ...c, status: normalizedStatus, situacao: normalizedStatus, profissionalNome: response.profissionalNome }
                  : c
              );
              consultationsRef.current = updatedConsultations;

              if (normalizedStatus === "CONCLUIDO") {
                // Limpa o crédito da consulta ativa (foi consumido)
                setActiveConsultationCreditId(null);
                toast({
                  title: "Consulta Finalizada",
                  description: "Sua teleconsulta com especialista foi concluída com sucesso.",
                });
                loadConsultations();
              } else if (normalizedStatus === "CANCELADO") {
                // Tenta restaurar crédito avulso (se existir)
                let creditRestored = false;
                try {
                  const { data: restoredCredits, error } = await (supabase as any)
                    .from("consultation_credits")
                    .update({
                      status: "available",
                      consultation_id: null,
                      used_at: null,
                    })
                    .eq("consultation_id", consultationId)
                    .eq("status", "used")
                    .select();

                  if (!error && restoredCredits && restoredCredits.length > 0) {
                    logger.info(`Crédito restaurado para consulta especialista cancelada ${consultationId}`);
                    setActiveConsultationCreditId(null);
                    loadAvailableCredits();
                    creditRestored = true;
                  }

                  // Se não restaurou crédito avulso, restaura a consulta do plano
                  if (!creditRestored) {
                    setActiveConsultationCreditId(null);
                    await decrementSpecialistConsultations();
                    logger.info(`Consulta do plano restaurada para consulta cancelada ${consultationId}`);
                  }

                  toast({
                    title: "Consulta Cancelada",
                    description: response.motivoCancelamento === 4
                      ? creditRestored
                        ? "Sua consulta expirou por tempo de espera. Seu crédito foi restaurado."
                        : "Sua consulta expirou por tempo de espera."
                      : creditRestored
                        ? "A consulta foi cancelada. Seu crédito foi restaurado."
                        : "A consulta foi cancelada.",
                  });
                } catch (restoreError) {
                  logger.error("Erro ao restaurar crédito:", restoreError);
                  toast({
                    title: "Consulta Cancelada",
                    description: "A consulta foi cancelada.",
                  });
                }
                loadConsultations();
              }
            }
          } catch (err) {
            logger.error(`[Especialistas] Erro ao verificar status da consulta ${consultationId}:`, err);
          }
        }
      } catch (err) {
        logger.error("[Especialistas] Erro no polling de consultas:", err);
      }
    };

    // Inicia polling após 5 segundos
    const initialDelay = setTimeout(() => {
      pollActiveConsultations();
    }, 5000);
    
    // Depois executa a cada 10 segundos
    const interval = setInterval(pollActiveConsultations, 10000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [accessToken, toast, loadConsultations, loadAvailableCredits, decrementSpecialistConsultations, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // ── Start new consultation flow ───────────────────────────────────────────

  const handleStartNewConsultation = async () => {
    if (!profile) {
      toast({
        title: "Perfil não carregado",
        description: "Aguarde o carregamento do perfil.",
        variant: "destructive",
      });
      return;
    }

    const cpf = profile.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) {
      toast({
        title: "CPF necessário",
        description:
          "É necessário ter um CPF válido cadastrado no perfil para acessar a telemedicina.",
        variant: "destructive",
      });
      navigate("/perfil");
      return;
    }

    if (!profile.full_name || !profile.email) {
      toast({
        title: "Dados incompletos",
        description: "Complete seu perfil antes de iniciar uma consulta.",
        variant: "destructive",
      });
      navigate("/perfil");
      return;
    }

    // Verifica se já existe consulta em andamento (TODAS as consultas, não só especialistas)
    const activeConsultations = consultations.filter(
      (c) =>
        normalizeConsultationStatus(c) === "AGUARDANDO" ||
        normalizeConsultationStatus(c) === "EM_ATENDIMENTO"
    );

    if (activeConsultations.length > 0) {
      toast({
        title: "Consulta em andamento",
        description:
          "Você já possui uma consulta em andamento. Aguarde o atendimento ser concluído ou cancele-o antes de iniciar uma nova consulta.",
        variant: "destructive",
      });
      return;
    }

    // Se não tem plano ativo
    if (!hasActivePlan) {
      // Se tem créditos disponíveis, usa o primeiro automaticamente
      if (effectiveAvailableCredits.length > 0) {
        const firstCredit = effectiveAvailableCredits[0];
        toast({
          title: "Usando crédito disponível",
          description: "Você tem uma consulta avulsa disponível. Selecione a especialidade para agendar.",
        });
        setPendingCreditId(firstCredit.id);
        setIsUsingPlanConsultation(false);
        setShowWizardModal(true);
        return;
      }
      // Sem créditos, mostra modal para comprar
      setShowStandaloneModal(true);
      return;
    }

    // Se tem plano mas já usou todas as consultas com especialista
    if (!hasSpecialistConsultationsAvailable) {
      // Se tem créditos disponíveis, usa o primeiro automaticamente
      if (effectiveAvailableCredits.length > 0) {
        const firstCredit = effectiveAvailableCredits[0];
        toast({
          title: "Usando crédito disponível",
          description: "Suas consultas do plano acabaram, mas você tem uma consulta avulsa disponível.",
        });
        setPendingCreditId(firstCredit.id);
        setIsUsingPlanConsultation(false);
        setShowWizardModal(true);
        return;
      }
      // Sem créditos, mostra modal para comprar
      setShowStandaloneModal(true);
      return;
    }

    // Tem consultas disponíveis no plano - marca que está usando do plano
    setIsUsingPlanConsultation(true);
    setShowWizardModal(true);
  };

  // Inicia consulta após pagamento de consulta avulsa
  const handleStartAfterPayment = async (creditId?: string) => {
    if (!profile) return;
    const cpf = profile.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) return;

    // Se temos um creditId, marcamos como usado IMEDIATAMENTE
    if (creditId) {
      setPendingCreditId(creditId);
      setActiveConsultationCreditId(creditId);
      
      // Atualiza no banco agora (consultation_id será associado depois)
      await (supabase as any)
        .from("consultation_credits")
        .update({
          status: "used",
          used_at: new Date().toISOString(),
        })
        .eq("id", creditId);
      
      // Remove da lista local imediatamente
      setAvailableCredits(prev => prev.filter(c => c.id !== creditId));
    }

    // Consulta avulsa - não está usando do plano
    setIsUsingPlanConsultation(false);
    setShowWizardModal(true);
  };

  // Usa um crédito existente para iniciar consulta
  const handleUseExistingCredit = async (creditId: string) => {
    if (!profile) return;
    
    setShowStandaloneModal(false);
    
    toast({
      title: "Usando crédito disponível",
      description: "Selecione a especialidade para agendar.",
    });

    // Marca o crédito como usado IMEDIATAMENTE (antes de criar consulta)
    setPendingCreditId(creditId);
    setActiveConsultationCreditId(creditId);
    
    // Atualiza no banco agora (consultation_id será associado depois)
    await (supabase as any)
      .from("consultation_credits")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
      })
      .eq("id", creditId);
    
    // Remove da lista local imediatamente
    setAvailableCredits(prev => prev.filter(c => c.id !== creditId));
    
    // Consulta avulsa - não está usando do plano
    setIsUsingPlanConsultation(false);
    setShowWizardModal(true);
  };

  // Verifica se veio do checkout de consulta avulsa
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const consultationCredit = params.get("consultation_credit");
    
    if (consultationCredit && profile && !pageLoading) {
      // Remove o parâmetro da URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      
      // Verifica se é um UUID válido (crédito do banco)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(consultationCredit);
      
      // Inicia o fluxo de agendamento automaticamente
      toast({
        title: "Pagamento confirmado!",
        description: "Selecione a especialidade para agendar sua consulta.",
      });
      
      setTimeout(() => {
        handleStartAfterPayment(isUUID ? consultationCredit : undefined);
      }, 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, pageLoading]);

  // Wizard confirmado → autentica + cria consulta com primeira especialidade disponível
  const handleWizardSubmit = async (
    respostasAnamnese: AnamneseResposta[],
    exames: { arquivoBase64: string }[]
  ) => {
    if (!profile) return;
    pendingAnamneseRef.current = { respostasAnamnese, exames };
    setShowWizardModal(false);

    const cpf = profile.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) return;

    await startConsultationFlow(cpf, profile);
  };

  // Quando especialidades são carregadas após o wizard, cria a consulta automaticamente
  const isAutoCreatingRef = useRef(false);
  useEffect(() => {
    if (step !== "selecting_specialty" || !pendingAnamneseRef.current || isAutoCreatingRef.current) return;
    if (specialties.length === 0) return;

    const pending = pendingAnamneseRef.current;
    pendingAnamneseRef.current = null;
    isAutoCreatingRef.current = true;

    const filteredSpecialties = specialties.filter((s) => {
      const nome = s.nome.toLowerCase();
      return !((nome.includes("clínico") || nome.includes("clinico")) && nome.includes("geral"));
    });
    const specialty = filteredSpecialties[0] || specialties[0];
    if (!specialty) {
      isAutoCreatingRef.current = false;
      return;
    }

    setSelectedSpecialtyName(specialty.nome);

    createSpecialistConsultation(specialty, pending.respostasAnamnese, pending.exames).then(async (success) => {
      isAutoCreatingRef.current = false;
      if (success) {
        if (isUsingPlanConsultation) {
          await incrementSpecialistConsultations();
        }
        if (accessToken) {
          await loadConsultations();
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, specialties]);

  // ── Join existing consultation ────────────────────────────────────────────

  /**
   * Resolve o pacienteToken para entrar em uma consulta.
   * Hierarquia de fontes:
   *  1. Token na própria consulta (raramente disponível via /obter)
   *  2. localStorage (salvo no momento da criação — persiste entre sessões)
   *  3. activeConsultation na mesma sessão
   *  4. GET /api/Atendimentos/{id} (fallback de rede)
   */
  const resolvePatientToken = async (consultation: Consultation): Promise<string | null> => {
    const { assemedClient } = await import("@/integrations/assemed/client");

    // 1. Token já presente
    if (consultation.pacienteToken) {
      if (import.meta.env.DEV) console.info("[Especialistas] token disponível na consulta:", consultation.id);
      return consultation.pacienteToken;
    }

    // 2. localStorage (consultas agendadas podem ser de sessões anteriores)
    const cached = assemedClient.getPatientToken(consultation.id);
    if (cached) {
      if (import.meta.env.DEV) console.info("[Especialistas] token recuperado do localStorage:", consultation.id);
      return cached;
    }

    // 3. Mesma sessão — activeConsultation pode ter o token do POST de criação
    if (activeConsultation?.id === consultation.id && activeConsultation.pacienteToken) {
      if (import.meta.env.DEV) console.info("[Especialistas] token recuperado do activeConsultation:", consultation.id);
      assemedClient.storePatientToken(consultation.id, activeConsultation.pacienteToken);
      return activeConsultation.pacienteToken;
    }

    // 4. Último recurso: GET /api/Atendimentos/{id}
    try {
      if (import.meta.env.DEV) console.info("[Especialistas] buscando token via GET /api/Atendimentos/", consultation.id);
      const fresh = await assemedClient.getConsultation(consultation.id);
      if (import.meta.env.DEV) console.info("[Especialistas] getConsultation →", fresh?.id, "pacienteToken:", fresh?.pacienteToken ? "presente" : "null");
      if (fresh?.pacienteToken) {
        assemedClient.storePatientToken(fresh.id, fresh.pacienteToken);
        return fresh.pacienteToken;
      }
    } catch (err) {
      console.error("[Especialistas] erro ao buscar consulta:", err);
    }

    console.error("[Especialistas] pacienteToken não encontrado para consulta:", consultation.id);
    return null;
  };

  const handleJoinConsultation = async (consultation: Consultation) => {
    setJoiningLoading(true);
    try {
      const isAgendada = !!consultation.dataAgendamento;
      const normalizedStatus = normalizeConsultationStatus(consultation);
      const especialidadeNomeFinal = consultation.especialidadeNome || "Especialista";

      // Consulta agendada em espera: inclui na fila via API
      if (isAgendada && normalizedStatus === "AGUARDANDO") {
        const result = await joinScheduledConsultation(consultation.id);

        if (!result) {
          // Erro já tratado pelo hook (setError)
          return;
        }

        if (result.pendingBillingSessionSecret) {
          toast({
            title: "Pagamento pendente",
            description: "Conclua o pagamento para entrar na consulta.",
            variant: "destructive",
          });
          return;
        }

        if (!result.pacienteToken) {
          toast({
            title: "Erro ao iniciar consulta",
            description: "Não foi possível iniciar a consulta. Tente novamente.",
            variant: "destructive",
          });
          return;
        }

        if (result.existePacienteAguardandoSemProfissional) {
          toast({
            title: "Aguardando profissional",
            description: "Você está na fila. O especialista será notificado em instantes.",
          });
        }

        // Navega para sala de espera com token — sem especialidade pois ainda será definida pelo atendente
        navigate(
          `/sala-espera/${consultation.id}?origem=especialistas&token=${encodeURIComponent(result.pacienteToken)}`
        );
        return;
      }

      // Consulta imediata ou em atendimento: resolve token pelos caches/API
      const token = await resolvePatientToken(consultation);

      // Navega para sala de espera — sem especialidade (será definida pelo atendente)
      const url = token
        ? `/sala-espera/${consultation.id}?origem=especialistas&token=${encodeURIComponent(token)}`
        : `/sala-espera/${consultation.id}?origem=especialistas`;
      navigate(url);
    } catch {
      toast({
        title: "Erro ao iniciar consulta",
        description: "Não foi possível iniciar a consulta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setJoiningLoading(false);
    }
  };

  // ── Cancel consultation ───────────────────────────────────────────────────

  const handleCancelConsultation = async (id: number) => {
    await cancelConsultation(id);
    
    // Tenta restaurar o crédito avulso se existir
    let creditRestored = false;
    try {
      // Primeiro tenta restaurar pelo consultation_id (consulta já associada)
      const { data: creditByConsultation, error: error1 } = await (supabase as any)
        .from("consultation_credits")
        .update({
          status: "available",
          consultation_id: null,
          used_at: null,
        })
        .eq("consultation_id", id)
        .eq("status", "used")
        .select();
      
      if (creditByConsultation && creditByConsultation.length > 0) {
        logger.info(`Crédito restaurado para consulta cancelada pelo usuário ${id}`);
        setActiveConsultationCreditId(null); // Limpa o crédito da consulta ativa
        loadAvailableCredits();
        creditRestored = true;
      } else if (pendingCreditId || activeConsultationCreditId) {
        // Se não encontrou pelo consultation_id, tenta restaurar pelo pendingCreditId ou activeConsultationCreditId
        const creditIdToRestore = pendingCreditId || activeConsultationCreditId;
        const { error: error2 } = await (supabase as any)
          .from("consultation_credits")
          .update({
            status: "available",
            consultation_id: null,
            used_at: null,
          })
          .eq("id", creditIdToRestore);
        
        if (!error2) {
          logger.info(`Crédito ${creditIdToRestore} restaurado`);
          setPendingCreditId(null);
          setActiveConsultationCreditId(null);
          loadAvailableCredits();
          creditRestored = true;
        }
      }
      
      // Se não restaurou crédito avulso e estava usando do plano, restaura a consulta do plano
      if (!creditRestored && (isUsingPlanConsultation || hasActivePlan)) {
        await decrementSpecialistConsultations();
        logger.info(`Consulta do plano restaurada para consulta cancelada ${id}`);
        setIsUsingPlanConsultation(false);
      }
    } catch (err) {
      logger.error("Erro ao restaurar crédito:", err);
    }
    
    toast({
      title: "Consulta cancelada",
      description: creditRestored 
        ? "Sua consulta foi cancelada e seu crédito foi restaurado."
        : "Sua consulta foi cancelada.",
    });
  };

  // ── Close iframe ──────────────────────────────────────────────────────────

  // ── Render: loading ao entrar em consulta existente ─────────────────────────

  if (joiningLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Estamos conectando você ao especialista…</p>
      </div>
    );
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render: specialty selection modal ─────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />
      <ActiveConsultationBanner accessToken={bannerAccessToken} />

      <main className="page-container !max-w-4xl">
        <PageHeader
          title="Consulta com Especialista"
          subtitle="Atendimento com médicos especialistas"
          icon={Stethoscope}
          iconColor="text-accent"
          iconBg="bg-accent/10"
          actions={
            <Button
              onClick={handleStartNewConsultation}
              disabled={step === "creating_consultation"}
              className="gap-2"
              size="lg"
            >
              {step === "creating_consultation" ? (
                <><Loader2 className="h-5 w-5 animate-spin" />Criando consulta...</>
              ) : (
                <><Plus className="h-5 w-5" />Agendar Consulta</>
              )}
            </Button>
          }
        />

        {/* Info card: consultas do plano */}
        {hasActivePlan && specialistConsultationsLimit > 0 && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      Consultas com Especialista - Plano {plan?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {specialistConsultationsRemaining > 0 ? (
                        <>Você ainda tem <span className="font-semibold text-primary">{specialistConsultationsRemaining}</span> consulta{specialistConsultationsRemaining !== 1 ? 's' : ''} disponível{specialistConsultationsRemaining !== 1 ? 'is' : ''} este ano</>
                      ) : (
                        <span className="text-amber-600">Você já utilizou todas as {specialistConsultationsLimit} consultas do seu plano</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {specialistConsultationsUsed}/{specialistConsultationsLimit}
                  </p>
                  <p className="text-xs text-muted-foreground">utilizadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info card: créditos de consulta avulsa */}
        {(effectiveAvailableCredits.length > 0 || creditsInUse > 0) && (
          <Card className={`mb-6 ${effectiveAvailableCredits.length > 0 ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${effectiveAvailableCredits.length > 0 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    {effectiveAvailableCredits.length > 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className={`font-medium ${effectiveAvailableCredits.length > 0 ? 'text-green-800' : 'text-yellow-800'}`}>
                      {effectiveAvailableCredits.length > 0 ? 'Consultas Avulsas Disponíveis' : 'Consulta em Andamento'}
                    </p>
                    <p className={`text-sm ${effectiveAvailableCredits.length > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {effectiveAvailableCredits.length > 0 ? (
                        <>
                          Você tem <span className="font-semibold">{effectiveAvailableCredits.length}</span> consulta{effectiveAvailableCredits.length !== 1 ? 's' : ''} avulsa{effectiveAvailableCredits.length !== 1 ? 's' : ''} paga{effectiveAvailableCredits.length !== 1 ? 's' : ''} para usar
                        </>
                      ) : (
                        <>Você tem {creditsInUse} consulta{creditsInUse !== 1 ? 's' : ''} em andamento usando crédito avulso</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${effectiveAvailableCredits.length > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {effectiveAvailableCredits.length > 0 ? effectiveAvailableCredits.length : creditsInUse}
                  </p>
                  <p className={`text-xs ${effectiveAvailableCredits.length > 0 ? 'text-green-700' : 'text-yellow-700'}`}>
                    {effectiveAvailableCredits.length > 0 
                      ? `disponível${effectiveAvailableCredits.length !== 1 ? 'is' : ''}` 
                      : 'em uso'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error alert */}
        {step === "error" && error && !showWizardModal && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Não foi possível continuar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading overlay após o wizard (autenticando/criando consulta) */}
        {(step === "authenticating" || step === "registering" || step === "loading_specialties" || step === "creating_consultation") && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <p className="font-medium text-foreground">
                {step === "registering" ? "Cadastrando paciente..." :
                 step === "authenticating" ? "Autenticando..." :
                 step === "loading_specialties" ? "Carregando especialidades..." :
                 "Iniciando consulta..."}
              </p>
            </div>
          </div>
        )}

        {/* Wizard de consulta com especialista */}
        {showWizardModal && (
          <ConsultaWizardModal
            onClose={() => setShowWizardModal(false)}
            onSubmit={handleWizardSubmit}
            titulo="Iniciar Atendimento"
            subtitulo="Atendimento · Telemedicina Novità"
            infoTexto="Você será conectado a um atendente disponível agora. Certifique-se de ter câmera e microfone funcionando antes de iniciar."
          />
        )}

        {/* Modal de consulta avulsa (usuários sem plano ou sem consultas disponíveis) */}
        <Dialog
          open={showStandaloneModal}
          onOpenChange={(open) => {
            if (!open) setShowStandaloneModal(false);
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary" />
                Consulta com Especialista
              </DialogTitle>
              <DialogDescription>
                {hasActivePlan && !hasSpecialistConsultationsAvailable ? (
                  <>
                    Você já utilizou suas {specialistConsultationsLimit} consulta{specialistConsultationsLimit !== 1 ? 's' : ''} com especialista do plano {plan?.name} este ano.
                    {availableCredits.length > 0 
                      ? " Use um crédito disponível ou compre uma consulta avulsa."
                      : " Compre uma consulta avulsa para continuar."}
                  </>
                ) : availableCredits.length > 0 
                  ? "Você tem créditos disponíveis! Use um abaixo ou compre uma nova consulta."
                  : "Pague uma consulta avulsa para ser atendido por um especialista"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Aviso de consultas esgotadas do plano */}
              {hasActivePlan && !hasSpecialistConsultationsAvailable && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Consultas do plano esgotadas</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    Você utilizou {specialistConsultationsUsed} de {specialistConsultationsLimit} consulta{specialistConsultationsLimit !== 1 ? 's' : ''} com especialista incluídas no seu plano {plan?.name}.
                    As consultas são renovadas anualmente.
                  </AlertDescription>
                </Alert>
              )}

              {/* Créditos disponíveis (apenas especialista) */}
              {availableCredits.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Seus créditos disponíveis:</p>
                  {availableCredits.map((credit) => (
                    <Card
                      key={credit.id}
                      className="cursor-pointer transition-all border-green-200 bg-green-50 hover:border-green-400 hover:shadow-md"
                      onClick={() => handleUseExistingCredit(credit.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="font-medium text-green-800">
                                Especialista
                              </p>
                              <p className="text-xs text-green-600">
                                Válido até {format(new Date(credit.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700">
                            Usar agora
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm text-muted-foreground text-center mb-3">
                      Ou compre uma nova consulta:
                    </p>
                  </div>
                </div>
              )}

              {/* Opção Especialista */}
              <Card 
                className="cursor-pointer transition-all hover:border-accent/50 hover:shadow-md"
                onClick={() => navigate("/checkout/consultation?type=especialista")}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <UserIcon className="h-6 w-6 text-accent" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">Consulta Avulsa - Especialista</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Consulta pontual com médico especialista de sua escolha.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-accent">R$ 119,90</p>
                      <p className="text-xs text-muted-foreground">por consulta</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CTA para planos */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground text-center mb-3">
                  Ou assine um plano para consultas ilimitadas com clínico geral
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/planos")}
                >
                  Ver planos disponíveis
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Consultations history */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading font-semibold text-foreground">
              Minhas Consultas
            </h2>
            {accessToken && (
              <Button
                variant="ghost"
                size="sm"
                onClick={loadConsultations}
                disabled={isLoadingConsultations}
                className="gap-2 text-muted-foreground"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingConsultations ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            )}
          </div>

          {/* ── Filtros de status ── */}
          {!isLoadingConsultations && specialistConsultations.length > 0 && (() => {
            const counts: Record<string, number> = { todos: specialistConsultations.length };
            specialistConsultations.forEach(c => {
              const s = normalizeConsultationStatus(c);
              counts[s] = (counts[s] || 0) + 1;
            });
            const tabs: { key: typeof consultaFilter; label: string; activeBg: string; Icon?: React.ComponentType<{ className?: string }>; ping?: boolean; pulse?: boolean }[] = [
              { key: "todos",          label: "Todos",           activeBg: "bg-gray-800" },
              { key: "AGUARDANDO",     label: "Aguardando",      activeBg: "bg-gradient-to-r from-amber-500 to-orange-500", Icon: Stethoscope, ping: true },
              { key: "EM_ATENDIMENTO", label: "Em Atendimento",  activeBg: "bg-green-500", Icon: Video, pulse: true },
              { key: "CONCLUIDO",      label: "Concluídas",      activeBg: "bg-emerald-600", Icon: CheckCircle },
              { key: "CANCELADO",      label: "Canceladas",      activeBg: "bg-slate-400", Icon: XCircle },
            ];
            return (
              <div className="flex items-center gap-2 flex-wrap mb-5">
                {tabs.map(tab => {
                  const count = counts[tab.key] || 0;
                  if (tab.key !== "todos" && count === 0) return null;
                  const isActive = consultaFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setConsultaFilter(tab.key)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isActive
                          ? `${tab.activeBg} text-white shadow-md scale-105`
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {tab.ping && isActive && (
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                        </span>
                      )}
                      {tab.pulse && isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                      )}
                      {tab.Icon && !isActive && <tab.Icon className="h-3 w-3 text-gray-500" />}
                      {tab.label}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? "bg-white/25 text-white" : "bg-gray-200 text-gray-500"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Loading consultations */}
          {isLoadingConsultations && (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          )}

          {/* Consultations list */}
          {!isLoadingConsultations && accessToken && (() => {
            const filtered = consultaFilter === "todos"
              ? specialistConsultations
              : specialistConsultations.filter(c => normalizeConsultationStatus(c) === consultaFilter);
            if (filtered.length === 0 && specialistConsultations.length > 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                  <p className="text-sm text-muted-foreground">Nenhuma consulta nessa categoria.</p>
                  <button onClick={() => setConsultaFilter("todos")} className="text-xs text-primary underline underline-offset-2">
                    Ver todas
                  </button>
                </div>
              );
            }
            if (filtered.length === 0) {
              return (
                <Card className="bg-card border-border/50">
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                    <UserIcon className="h-10 w-10 text-muted-foreground" />
                    <p className="text-muted-foreground text-center">Você ainda não possui consultas com especialistas.</p>
                    <Button variant="outline" onClick={handleStartNewConsultation} className="gap-2 mt-1">
                      <Plus className="h-4 w-4" />
                      Nova consulta
                    </Button>
                  </CardContent>
                </Card>
              );
            }
            return (
              <div className="grid gap-4 md:grid-cols-2">
                {filtered.map(consultation => (
                  <ConsultationHistoryCard
                    key={consultation.id}
                    consultation={consultation}
                    onJoin={handleJoinConsultation}
                    onCancel={handleCancelConsultation}
                    joiningLoading={joiningLoading}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      </main>

    </div>
  );
};

export default Especialistas;
