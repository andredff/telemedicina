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
import type { Consultation, Specialty, ConsultationStatus } from "@/integrations/assemed/types";
import { normalizeConsultationStatus } from "@/integrations/assemed/types";
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
          <a
            href={consultationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Abrir em nova aba</span>
          </a>
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
  const [selectedSpecialtyName, setSelectedSpecialtyName] = useState<string>("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);

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
    return !nome.includes("cl") || !nome.includes("geral");
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

    // Verifica se já existe consulta em andamento (apenas especialistas)
    const activeConsultations = specialistConsultations.filter(
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

    // Abre o modal de seleção de especialidades
    await startConsultationFlow(cpf, profile);
    setShowSpecialtyModal(true);
  };

  const handleSelectSpecialty = async (specialty: Specialty) => {
    if (!specialty) return;
    setSelectedSpecialtyName(specialty.nome);
    setSelectedSpecialty(specialty);
    setShowSpecialtyModal(false);
    await createConsultation(specialty);
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
    await createConsultation(selectedSpecialty);
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
    toast({
      title: "Consulta cancelada",
      description: "Sua consulta foi cancelada com sucesso.",
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
                Agende consultas com médicos especialistas
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

        {/* Error alert (outside modal, e.g. after modal is closed) */}
        {step === "error" && error && !showSpecialtyModal && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={resetFlow}
                className="gap-2 shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </AlertDescription>
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
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={async () => {
                    if (profile) {
                      const cpf = profile.cpf.replace(/\D/g, "");
                      await startConsultationFlow(cpf, profile);
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
              </div>
            )}

            {/* Specialties dropdown */}
            {step === "selecting_specialty" && specialties.length > 0 && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Selecione a especialidade
                  </label>
                  <Select
                    value={selectedSpecialty?.id.toString() || ""}
                    onValueChange={(value) => {
                      const specialty = specialties.find((s) => s.id.toString() === value);
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
                      {specialties.map((specialty) => (
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
            {step === "selecting_specialty" && specialties.length === 0 && (
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
                    Agendar primeira consulta
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
