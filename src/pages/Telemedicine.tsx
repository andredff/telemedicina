import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle,
  Video,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { useToast } from "@/hooks/use-toast";
import { TelemedicineFrame, AccessBlockedModal } from "@/components/telemedicine";
import { useSubscriptionStatus, useCanAccessTelemedicine } from "@/hooks/use-telemedicine";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
  full_name: string;
  cpf: string;
  email: string;
  phone: string;
  birth_date: string;
  gender: "M" | "F";
}

const Telemedicine = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAuthenticating = false;
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tipoConsulta, setTipoConsulta] = useState<"imediata" | "agendada">("imediata");

  // Subscription checks
  const {
    data: subscription,
    isLoading: isSubscriptionLoading,
  } = useSubscriptionStatus(user?.id || null);

  const {
    data: accessCheck,
    isLoading: isAccessCheckLoading,
  } = useCanAccessTelemedicine(user?.id || null);

  const canAccess = accessCheck?.canAccess === true;
  const accessDenialReason = accessCheck?.reason;
  const accessDenialMessage = accessCheck?.message;
  const isCheckingAccess = isSubscriptionLoading || isAccessCheckLoading;

  // Busca o perfil do usuário
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, birth_date, phone, cpf, gender")
        .eq("id", userId)
        .single();

      if (!error && data) {
        const { data: userData } = await supabase.auth.getUser();
        const metadata = userData.user?.user_metadata;
        const identity = userData.user?.identities?.[0];
        const identityCpf = identity?.identity_data?.cpf as string | undefined;
        const cpf = data.cpf || (metadata?.cpf as string | undefined) || identityCpf || "";

        setProfile({
          full_name: data.full_name,
          email: data.email,
          cpf,
          phone: data.phone || metadata?.phone || "",
          birth_date: data.birth_date || metadata?.birth_date || "",
          gender: data.gender || metadata?.gender || "M",
        });
      }
    } catch (error) {
      logger.error("Erro ao buscar perfil:", error);
    }
  };

  // Auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
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
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleStartConsultation = (tipo: "imediata" | "agendada") => {
    if (tipo === "imediata") {
      navigate("/teleconsultas");
    } else {
      navigate("/especialistas");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Iframe aberto
  if (accessToken) {
    return (
      <TelemedicineFrame
        accessToken={accessToken}
        tipoConsulta={tipoConsulta}
        onClose={() => {
          setAccessToken(null);
          setTipoConsulta("imediata");
        }}
        title="Telemedicina Novità Home Care"
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        isAuthenticated 
        onLogout={handleLogout}
        title="Telemedicina"
      />

      <main className="page-container">
        <BackLink to="/dashboard" label="Voltar ao Dashboard" />
        {/* Status da assinatura */}
        {isCheckingAccess ? (
          <Skeleton className="h-20 w-full mb-6" />
        ) : canAccess ? (
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Assinatura Ativa</AlertTitle>
            <AlertDescription>
              Plano {subscription?.planType?.toUpperCase()} •
              {subscription?.consultationsRemaining
                ? ` ${subscription.consultationsRemaining} consultas disponíveis`
                : " Consultas ilimitadas"}
              {subscription?.expiresAt && (
                <> • Válido até {new Date(subscription.expiresAt).toLocaleDateString("pt-BR")}</>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {accessDenialReason === "expired"
                ? "Assinatura Expirada"
                : accessDenialReason === "inactive"
                ? "Assinatura Inativa"
                : "Acesso Restrito"}
            </AlertTitle>
            <AlertDescription>
              {accessDenialMessage || "Você precisa de uma assinatura ativa para acessar a telemedicina."}
              <Button
                variant="link"
                className="p-0 h-auto ml-2"
                onClick={() => navigate("/planos")}
              >
                {accessDenialReason === "no_subscription" ? "Ver planos" : "Renovar assinatura"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Opções de consulta */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-heading font-semibold mb-2">
              Iniciar Teleconsulta
            </h2>
            <p className="text-muted-foreground">
              Escolha o tipo de atendimento desejado
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all cursor-pointer group"
              onClick={() => handleStartConsultation("imediata")}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                  {isAuthenticating && tipoConsulta === "imediata" ? (
                    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
                  ) : (
                    <Video className="h-7 w-7 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg">Consulta Imediata</p>
                  <p className="text-sm text-muted-foreground">Atendimento com clínico geral 24h, sem necessidade de agendamento</p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all cursor-pointer group"
              onClick={() => handleStartConsultation("agendada")}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors shrink-0">
                  {isAuthenticating && tipoConsulta === "agendada" ? (
                    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-accent" />
                  ) : (
                    <Calendar className="h-7 w-7 text-accent" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg">Agendar Consulta</p>
                  <p className="text-sm text-muted-foreground">Escolha especialidade, data e horário para sua consulta</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Modal de acesso bloqueado */}
      <AccessBlockedModal
        open={showBlockedModal}
        onOpenChange={setShowBlockedModal}
        reason={(accessDenialReason === "inactive" ? "payment_pending" : accessDenialReason) || "no_subscription"}
      />
    </div>
  );
};

export default Telemedicine;
