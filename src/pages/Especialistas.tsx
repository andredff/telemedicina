import { useEffect, useState, useRef, useCallback } from "react";
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
  ExternalLink,
  FileText,
  Star,
  Plus,
  RefreshCw,
  User as UserIcon,
} from "lucide-react";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAssemedConsultation } from "@/hooks/useAssemedConsultation";
import { useSubscription } from "@/hooks/useSubscription";
import type { Consultation, Specialty, ConsultationStatus } from "@/integrations/assemed/types";
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
    label: "Aguardando",
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
}: {
  consultation: Consultation;
  onJoin: (c: Consultation) => void;
  onCancel: (id: number) => void;
}) {
  const normalizedStatus = normalizeConsultationStatus(consultation);
  const status = statusConfig[normalizedStatus];
  const StatusIcon = status.icon;
  const isActive =
    normalizedStatus === "AGUARDANDO" || normalizedStatus === "EM_ATENDIMENTO";

  return (
    <Card className="bg-card border-border/50 hover:shadow-card transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Video className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-base truncate">
              Consulta #{consultation.id}
            </CardTitle>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${status.bgColor}`}
          >
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Especialidade</p>
            <p className="font-medium">{consultation.especialidadeNome || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Profissional</p>
            <p className="font-medium">
              {normalizedStatus === "CANCELADO"
                ? "Consulta cancelada"
                : consultation.profissionalNome || "Aguardando..."}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Data</p>
            <p className="font-medium">{formatDate(consultation.dataHoraCriacao)}</p>
          </div>
          {consultation.dataHoraFim && consultation.dataHoraInicio && (
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Duração</p>
              <p className="font-medium">
                {calculateDuration(consultation.dataHoraInicio, consultation.dataHoraFim)}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
          {isActive && (
            <Button size="sm" onClick={() => onJoin(consultation)} className="gap-2">
              {normalizedStatus === "AGUARDANDO" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrar na sala
                </>
              ) : (
                <>
                  <Video className="h-4 w-4" />
                  Entrar na Consulta
                </>
              )}
            </Button>
          )}
          {normalizedStatus === "AGUARDANDO" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCancel(consultation.id)}
            >
              Cancelar
            </Button>
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
      </CardContent>
    </Card>
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
  const iframePageUrl = `/iframe.html?atendimentoId=${atendimentoId}&token=${encodeURIComponent(
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
  const [joiningConsultation, setJoiningConsultation] =
    useState<Consultation | null>(null);
  const [showSpecialtyModal, setShowSpecialtyModal] = useState(false);
  const [showStandaloneModal, setShowStandaloneModal] = useState(false);
  const [selectedSpecialtyName, setSelectedSpecialtyName] = useState<string>("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [pendingCreditId, setPendingCreditId] = useState<string | null>(null);
  const [isUsingPlanConsultation, setIsUsingPlanConsultation] = useState(false);
  const [availableCredits, setAvailableCredits] = useState<{
    id: string;
    type: string;
    amount: number;
    expires_at: string;
  }[]>([]);

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
    createConsultation,
    loadConsultations,
    cancelConsultation,
    closeConsultation,
    resetFlow,
  } = useAssemedConsultation();

  // Filter consultations to exclude "Clínico Geral" (only show specialist consultations)
  const specialistConsultations = consultations.filter((c) => {
    const nome = (c.especialidadeNome || "").toLowerCase();
    return !(nome.includes("clínico") || nome.includes("clinico")) || !nome.includes("geral");
  });

  // Filter specialties dropdown: exclude Clínico Geral
  const filteredSpecialties = specialties.filter((s) => {
    const nome = s.nome.toLowerCase();
    return !((nome.includes("clínico") || nome.includes("clinico")) && nome.includes("geral"));
  });

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
  
  // Mantém ref atualizado
  useEffect(() => {
    consultationsRef.current = specialistConsultations;
  }, [specialistConsultations]);

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

  // Restaura créditos órfãos (marcados como "used" mas sem consulta ativa)
  const restoreOrphanCredits = useCallback(async () => {
    if (!user) return;
    
    // Busca créditos que estão como "used" para este usuário
    const { data: usedCredits, error: fetchError } = await (supabase as any)
      .from("consultation_credits")
      .select("id, consultation_id")
      .eq("user_id", user.id)
      .eq("status", "used")
      .eq("type", "especialista");
    
    if (fetchError || !usedCredits || usedCredits.length === 0) return;
    
    // Para cada crédito usado, verifica se a consulta ainda está ativa
    for (const credit of usedCredits) {
      if (!credit.consultation_id) {
        // Crédito sem consultation_id - restaura
        await (supabase as any)
          .from("consultation_credits")
          .update({ status: "available", used_at: null })
          .eq("id", credit.id);
        logger.info(`Crédito órfão ${credit.id} restaurado (sem consultation_id)`);
        continue;
      }
      
      // Verifica se a consulta ainda está ativa localmente
      const isActiveLocally = specialistConsultations.some(
        c => c.id === credit.consultation_id && 
        (normalizeConsultationStatus(c) === "AGUARDANDO" || normalizeConsultationStatus(c) === "EM_ATENDIMENTO")
      );
      
      if (!isActiveLocally) {
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

  // Carrega créditos quando o usuário é definido
  useEffect(() => {
    loadAvailableCredits();
  }, [loadAvailableCredits]);

  // Restaura créditos órfãos quando as consultas são carregadas
  const hasRestoredOrphans = useRef(false);
  useEffect(() => {
    if (!isLoadingConsultations && user && !hasRestoredOrphans.current) {
      hasRestoredOrphans.current = true;
      restoreOrphanCredits();
    }
  }, [isLoadingConsultations, user, restoreOrphanCredits]);

  // Recarrega créditos quando abre o modal (para garantir dados atualizados)
  useEffect(() => {
    if (showStandaloneModal) {
      loadAvailableCredits();
    }
  }, [showStandaloneModal, loadAvailableCredits]);

  // Marca o crédito como usado quando a consulta for criada
  useEffect(() => {
    const markCreditAsUsed = async () => {
      if (activeConsultation && activeConsultation.id && pendingCreditId) {
        // Usa any porque a tabela consultation_credits ainda não está nos tipos gerados
        const { error } = await (supabase as any)
          .from("consultation_credits")
          .update({
            status: "used",
            consultation_id: activeConsultation.id,
            used_at: new Date().toISOString(),
          })
          .eq("id", pendingCreditId);

        if (error) {
          logger.error("Error marking credit as used:", error);
        }
        setPendingCreditId(null);
        // Recarrega os créditos disponíveis
        loadAvailableCredits();
      }
    };
    markCreditAsUsed();
  }, [activeConsultation, pendingCreditId, loadAvailableCredits]);

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
            
            // Verifica se houve mudança
            if (normalizedStatus !== currentStatus || 
                response.profissionalNome !== currentConsultation.profissionalNome) {
              
              // Notifica o usuário
              if (normalizedStatus === "CONCLUIDO") {
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
                    loadAvailableCredits();
                    creditRestored = true;
                  }
                  
                  // Se não restaurou crédito avulso, restaura a consulta do plano
                  if (!creditRestored) {
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
              } else if (normalizedStatus === "EM_ATENDIMENTO" && currentStatus === "AGUARDANDO") {
                toast({
                  title: "Médico Disponível",
                  description: `${response.profissionalNome || "O médico"} está pronto para atendê-lo.`,
                });
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
  }, [accessToken, toast, loadConsultations, loadAvailableCredits, decrementSpecialistConsultations]);

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
      if (availableCredits.length > 0) {
        const firstCredit = availableCredits[0];
        toast({
          title: "Usando crédito disponível",
          description: "Você tem uma consulta avulsa disponível. Iniciando...",
        });
        setPendingCreditId(firstCredit.id);
        setIsUsingPlanConsultation(false);
        await startConsultationFlow(cpf, profile);
        setShowSpecialtyModal(true);
        return;
      }
      // Sem créditos, mostra modal para comprar
      setShowStandaloneModal(true);
      return;
    }

    // Se tem plano mas já usou todas as consultas com especialista
    if (!hasSpecialistConsultationsAvailable) {
      // Se tem créditos disponíveis, usa o primeiro automaticamente
      if (availableCredits.length > 0) {
        const firstCredit = availableCredits[0];
        toast({
          title: "Usando crédito disponível",
          description: "Suas consultas do plano acabaram, mas você tem uma consulta avulsa disponível.",
        });
        setPendingCreditId(firstCredit.id);
        setIsUsingPlanConsultation(false);
        await startConsultationFlow(cpf, profile);
        setShowSpecialtyModal(true);
        return;
      }
      // Sem créditos, mostra modal para comprar
      setShowStandaloneModal(true);
      return;
    }

    // Tem consultas disponíveis no plano - marca que está usando do plano
    setIsUsingPlanConsultation(true);

    // Abre o modal de seleção de especialidades
    await startConsultationFlow(cpf, profile);
    setShowSpecialtyModal(true);
  };

  // Inicia consulta após pagamento de consulta avulsa
  const handleStartAfterPayment = async (creditId?: string) => {
    if (!profile) return;
    const cpf = profile.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) return;

    // Se temos um creditId, guardamos para marcar como usado depois
    if (creditId) {
      setPendingCreditId(creditId);
    }

    // Consulta avulsa - não está usando do plano
    setIsUsingPlanConsultation(false);

    // Inicia o fluxo de consulta com especialista
    await startConsultationFlow(cpf, profile);
    setShowSpecialtyModal(true);
  };

  // Usa um crédito existente para iniciar consulta
  const handleUseExistingCredit = async (creditId: string) => {
    if (!profile) return;
    
    setShowStandaloneModal(false);
    
    toast({
      title: "Usando crédito disponível",
      description: "Iniciando sua consulta...",
    });
    
    setTimeout(() => {
      handleStartAfterPayment(creditId);
    }, 500);
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
      
      // Inicia a consulta automaticamente
      toast({
        title: "Pagamento confirmado!",
        description: "Iniciando sua consulta...",
      });
      
      setTimeout(() => {
        handleStartAfterPayment(isUUID ? consultationCredit : undefined);
      }, 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, pageLoading]);

  const handleSelectSpecialty = async (specialty: Specialty) => {
    if (!specialty) return;
    setSelectedSpecialtyName(specialty.nome);
    setSelectedSpecialty(specialty);
    setShowSpecialtyModal(false);
    
    const success = await createConsultation(specialty);
    
    // Só incrementa o contador se a consulta foi criada com sucesso
    if (success && isUsingPlanConsultation) {
      await incrementSpecialistConsultations();
      logger.info("Consulta do plano incrementada após criação bem-sucedida");
    }
  };

  const handleConfirmSpecialty = async () => {
    if (!selectedSpecialty) {
      toast({
        title: "Selecione uma especialidade",
        description: "Por favor, selecione uma especialidade para continuar.",
        variant: "destructive",
      });
      return;
    }
    setShowSpecialtyModal(false);
    
    const success = await createConsultation(selectedSpecialty);
    
    // Só incrementa o contador se a consulta foi criada com sucesso
    if (success && isUsingPlanConsultation) {
      await incrementSpecialistConsultations();
      logger.info("Consulta do plano incrementada após criação bem-sucedida");
    }
  };

  const handleCloseSpecialtyModal = () => {
    setShowSpecialtyModal(false);
    // Não chama resetFlow() para preservar o estado de autenticação
  };

  // ── Join existing consultation ────────────────────────────────────────────

  const handleJoinConsultation = async (consultation: Consultation) => {
    // Se o token estiver ausente, busca detalhes atualizados da consulta
    if (!consultation.pacienteToken) {
      try {
        const { assemedClient } = await import("@/integrations/assemed/client");
        const fresh = await assemedClient.getConsultation(consultation.id);
        if (fresh && fresh.pacienteToken) {
          setJoiningConsultation(fresh);
          return;
        }
      } catch {
        // fallback: usa a consulta original mesmo sem token
      }
    }
    setJoiningConsultation(consultation);
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
        loadAvailableCredits();
        creditRestored = true;
      } else if (pendingCreditId) {
        // Se não encontrou pelo consultation_id, tenta restaurar pelo pendingCreditId
        // (caso o crédito ainda não tenha sido associado à consulta)
        const { error: error2 } = await (supabase as any)
          .from("consultation_credits")
          .update({
            status: "available",
            consultation_id: null,
            used_at: null,
          })
          .eq("id", pendingCreditId);
        
        if (!error2) {
          logger.info(`Crédito pendente ${pendingCreditId} restaurado`);
          setPendingCreditId(null);
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

  const handleCloseIframe = useCallback(() => {
    setJoiningConsultation(null);
    closeConsultation();
    // Reload consultations to reflect updated status
    if (accessToken) {
      loadConsultations();
    }
  }, [closeConsultation, loadConsultations, accessToken]);

  // ── Render: new consultation - show iframe inline ────────────────────────────

  if (activeConsultation && activeConsultation.pacienteToken) {
    return (
      <ConsultationIframe
        atendimentoId={activeConsultation.id}
        pacienteToken={activeConsultation.pacienteToken}
        especialidade={selectedSpecialtyName}
        onClose={handleCloseIframe}
      />
    );
  }

  // ── Render: full-screen iframe for joining existing consultation ───────────

  if (joiningConsultation && joiningConsultation.pacienteToken) {
    return (
      <ConsultationIframe
        atendimentoId={joiningConsultation.id}
        pacienteToken={joiningConsultation.pacienteToken}
        especialidade={joiningConsultation.especialidadeNome || "Consulta"}
        onClose={() => setJoiningConsultation(null)}
      />
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

  const isFlowLoading =
    step === "registering" ||
    step === "authenticating" ||
    step === "loading_specialties" ||
    step === "creating_consultation";

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />
      <ActiveConsultationBanner accessToken={bannerAccessToken} />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page title */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Voltar ao Dashboard
          </button>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
                Consulta com Especialista
              </h1>
              <p className="text-muted-foreground mt-1">
                Atendimento com médicos especialistas
              </p>
            </div>
            <Button
              onClick={handleStartNewConsultation}
              disabled={step === "creating_consultation"}
              className="gap-2 shrink-0"
              size="lg"
            >
              {step === "creating_consultation" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Criando consulta...
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Nova Consulta
                </>
              )}
            </Button>
          </div>
        </div>

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
        {availableCredits.length > 0 && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800">
                      Consultas Avulsas Disponíveis
                    </p>
                    <p className="text-sm text-green-600">
                      Você tem <span className="font-semibold">{availableCredits.length}</span> consulta{availableCredits.length !== 1 ? 's' : ''} avulsa{availableCredits.length !== 1 ? 's' : ''} paga{availableCredits.length !== 1 ? 's' : ''} para usar
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">
                    {availableCredits.length}
                  </p>
                  <p className="text-xs text-green-700">disponível{availableCredits.length !== 1 ? 'is' : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error alert (outside modal, e.g. after modal is closed) */}
        {step === "error" && error && !showSpecialtyModal && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Não foi possível continuar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Specialty selection modal */}
        <Dialog
          open={showSpecialtyModal}
          onOpenChange={(open) => {
            if (!open) handleCloseSpecialtyModal();
          }}
        >
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Nova Consulta
              </DialogTitle>
              <DialogDescription>
                Selecione a especialidade para iniciar seu atendimento
              </DialogDescription>
            </DialogHeader>

            {/* Loading state inside modal */}
            {(step === "authenticating" ||
              step === "registering" ||
              step === "loading_specialties") && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {step === "registering" && "Cadastrando paciente..."}
                  {step === "authenticating" && "Autenticando..."}
                  {step === "loading_specialties" && "Carregando especialidades..."}
                </p>
              </div>
            )}

            {/* Error inside modal */}
            {step === "error" && error && (
              <div className="space-y-4 py-2">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Não foi possível continuar</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}

            {/* Specialties dropdown */}
            {step === "selecting_specialty" && filteredSpecialties.length > 0 && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Selecione a especialidade
                  </label>
                  <Select
                    value={selectedSpecialty?.id.toString() || ""}
                    onValueChange={(value) => {
                      const specialty = filteredSpecialties.find((s) => s.id.toString() === value);
                      if (specialty) {
                        setSelectedSpecialty(specialty);
                        setSelectedSpecialtyName(specialty.nome);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Escolha uma especialidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSpecialties.map((specialty) => (
                        <SelectItem key={specialty.id} value={specialty.id.toString()}>
                          <div className="flex items-center justify-between w-full">
                            <span>{specialty.nome}</span>
                            {specialty.triagem && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Triagem
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={handleConfirmSpecialty}
                  disabled={!selectedSpecialty || isFlowLoading}
                >
                  {isFlowLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Criando consulta...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </div>
            )}

            {/* No specialties */}
            {step === "selecting_specialty" && filteredSpecialties.length === 0 && (
              <Alert className="my-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Nenhuma especialidade disponível</AlertTitle>
                <AlertDescription>
                  Não há especialidades disponíveis para criação de atendimento
                  no momento. Tente novamente mais tarde.
                </AlertDescription>
              </Alert>
            )}
          </DialogContent>
        </Dialog>

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
                <RefreshCw
                  className={`h-4 w-4 ${isLoadingConsultations ? "animate-spin" : ""}`}
                />
                Atualizar
              </Button>
            )}
          </div>

          {/* Loading consultations */}
          {isLoadingConsultations && (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          )}

          {/* Consultations list */}
          {!isLoadingConsultations && accessToken && specialistConsultations.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {specialistConsultations.map((consultation) => (
                <ConsultationHistoryCard
                  key={consultation.id}
                  consultation={consultation}
                  onJoin={handleJoinConsultation}
                  onCancel={handleCancelConsultation}
                />
              ))}
            </div>
          )}

          {/* Empty state after loading */}
          {!isLoadingConsultations &&
            accessToken &&
            specialistConsultations.length === 0 && (
              <Card className="bg-card border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                  <UserIcon className="h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground text-center">
                    Você ainda não possui consultas com especialistas.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleStartNewConsultation}
                    className="gap-2 mt-1"
                  >
                    <Plus className="h-4 w-4" />
                    Nova consulta
                  </Button>
                </CardContent>
              </Card>
            )}
        </div>
      </main>
    </div>
  );
};

export default Especialistas;
