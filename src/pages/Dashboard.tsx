import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import {
  FileText,
  Calendar,
  User,
  ChevronRight,
  Video,
  Pill,
  Clock,
  Package,
  Crown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { getRecentActivities, type Activity } from "@/services/activityService";
import { TelemedicineFrame } from "@/components/telemedicine";
import { useAssemedAuth } from "@/hooks/useAssemedAuth";
import { useToast } from "@/hooks/use-toast";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  price: number;
}

interface Prescription {
  id: string;
  patient_name: string;
  doctor_name: string;
  date: string;
  status: string;
  medications?: Medication[];
}

interface ProfileData {
  full_name: string;
  email: string;
  cpf?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
}

interface UserSubscription {
  id: string;
  status: string;
  expires_at: string | null;
  plan: {
    name: string;
    type: string;
    description: string;
  } | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { authenticate, isAuthenticating } = useAssemedAuth();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tipoConsulta, setTipoConsulta] = useState<"imediata" | "agendada">("imediata");

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error && error.code === '42703') {
        const { data: fallbackData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        await fetchCpfFromMetadata(fallbackData);
        return;
      }

      if (data) {
        await fetchCpfFromMetadata(data);
      } else {
        await fetchCpfFromMetadata(undefined);
      }
    } catch (error) {
      logger.error("Error fetching profile:", error);
      await fetchCpfFromMetadata(undefined);
    }
  };

  const fetchCpfFromMetadata = async (existingData?: Record<string, unknown>) => {
    let cpf: string | undefined;

    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.user_metadata?.cpf) {
      cpf = userData.user.user_metadata.cpf as string;
    }

    if (!cpf && userData?.user?.identities) {
      const identity = userData.user.identities[0];
      if (identity?.identity_data?.cpf) {
        cpf = identity.identity_data.cpf as string;
      }
    }

    const profileData: ProfileData = {
      full_name: (existingData?.full_name as string) || (userData?.user?.user_metadata?.full_name as string) || userData?.user?.email?.split('@')[0] || "",
      email: (existingData?.email as string) || userData?.user?.email || "",
      phone: (existingData?.phone as string) || (userData?.user?.user_metadata?.phone as string) || "",
      birth_date: (existingData?.birth_date as string) || (userData?.user?.user_metadata?.birth_date as string) || "",
      gender: (existingData?.gender as "M" | "F") || (userData?.user?.user_metadata?.gender as "M" | "F") || "M",
      cpf: cpf || "",
    };

    setProfile(profileData);
  };

  const fetchPrescriptions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (error) {
        logger.error("Error fetching prescriptions:", error);
        return;
      }

      if (data) {
        setPrescriptions(data);
      }
    } catch (error) {
      logger.error("Error fetching prescriptions:", error);
    }
  };

  const fetchSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select(`
          id,
          status,
          expires_at,
          plan:subscription_plans (
            name,
            type,
            description
          )
        `)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (error) {
        logger.error("Error fetching subscription:", error);
        return;
      }

      if (data) {
        const subscriptionData: UserSubscription = {
          id: data.id,
          status: data.status,
          expires_at: data.expires_at,
          plan: Array.isArray(data.plan) ? data.plan[0] : data.plan
        };
        setSubscription(subscriptionData);
      }
    } catch (error) {
      logger.error("Error fetching subscription:", error);
    }
  };

  const fetchRecentActivities = async (userId: string) => {
    try {
      const activities = await getRecentActivities(userId, 10);
      setRecentActivities(activities);
    } catch (error) {
      logger.error("Error fetching activities:", error);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session) {
          navigate("/auth");
        } else if (session.user) {
          fetchProfile(session.user.id);
          fetchPrescriptions(session.user.id);
          fetchSubscription(session.user.id);
          fetchRecentActivities(session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
      } else if (session.user) {
        fetchProfile(session.user.id);
        fetchPrescriptions(session.user.id);
        fetchSubscription(session.user.id);
        fetchRecentActivities(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleStartConsultation = async (tipo: "imediata" | "agendada") => {
    if (!subscription?.plan) {
      toast({
        title: "Plano necessário",
        description: "Você precisa assinar um plano para ter acesso à telemedicina.",
        variant: "destructive",
      });
      navigate("/planos");
      return;
    }

    if (!profile?.cpf) {
      toast({
        title: "CPF necessário",
        description: "É necessário ter CPF cadastrado no perfil para acessar a telemedicina.",
        variant: "destructive",
      });
      navigate("/perfil");
      return;
    }

    const cpf = profile.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) {
      toast({
        title: "CPF inválido",
        description: "O CPF cadastrado no perfil é inválido. Por favor, atualize seus dados.",
        variant: "destructive",
      });
      navigate("/perfil");
      return;
    }

    toast({
      title: "Autenticando...",
      description: tipo === "imediata"
        ? "Preparando consulta imediata..."
        : "Preparando agendamento de consulta...",
    });

    try {
      const token = await authenticate(cpf, profile);
      setAccessToken(token);
      setTipoConsulta(tipo);
    } catch (error: unknown) {
      logger.error("Erro ao acessar telemedicina:", error);
      toast({
        title: "Erro ao acessar telemedicina",
        description: error instanceof Error ? error.message : "Não foi possível acessar a telemedicina. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "default",
      partial: "secondary",
      completed: "outline",
    } as const;

    const labels = {
      pending: "Pendente",
      partial: "Parcial",
      completed: "Concluído",
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  // Renderiza o iframe white-label se houver token
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const userName = profile?.full_name || user?.user_metadata?.full_name || "Paciente";

  const formatExpirationDate = (dateStr: string | null) => {
    if (!dateStr) return "Sem data definida";
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  const getPlanDescription = () => {
    if (!subscription?.plan) return "Você ainda não possui um plano ativo";
    return subscription.plan.description || "Consultas ilimitadas com clínico geral";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-2">
            Olá, {userName.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas consultas e receitas médicas
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card
            className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all cursor-pointer group"
            onClick={() => handleStartConsultation("imediata")}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                {isAuthenticating ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                ) : (
                  <Video className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">Consulta Imediata</p>
                <p className="text-xs text-muted-foreground">Clínico geral 24h</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all cursor-pointer group"
            onClick={() => handleStartConsultation("agendada")}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <Calendar className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="font-medium text-foreground">Agendar</p>
                <p className="text-xs text-muted-foreground">Especialistas</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all cursor-pointer group" onClick={() => navigate("/farmacia")}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-medical-green/10 flex items-center justify-center group-hover:bg-medical-green/20 transition-colors">
                <Pill className="h-6 w-6 text-medical-green" />
              </div>
              <div>
                <p className="font-medium text-foreground">Farmácia</p>
                <p className="text-xs text-muted-foreground">Entrega em casa</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all cursor-pointer group" onClick={() => navigate("/orders")}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-medical-orange/10 flex items-center justify-center group-hover:bg-medical-orange/20 transition-colors">
                <Package className="h-6 w-6 text-medical-orange" />
              </div>
              <div>
                <p className="font-medium text-foreground">Meus Pedidos</p>
                <p className="text-xs text-muted-foreground">Acompanhe entregas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {subscription?.plan ? (
          <Card className="mb-8 gradient-hero border-0 text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-sm text-primary-foreground/80">Seu plano atual</p>
                  <h3 className="text-2xl font-heading font-bold">Plano {subscription.plan.name}</h3>
                  <p className="text-sm text-primary-foreground/80 mt-1">
                    {getPlanDescription()} • Válido até {formatExpirationDate(subscription.expires_at)}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    className="bg-card text-foreground hover:bg-card/90"
                    onClick={() => navigate("/meu-plano")}
                  >
                    Fazer upgrade
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8 border-dashed border-2 border-primary/30 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Crown className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-heading font-bold text-foreground">Você ainda não tem um plano</h3>
                    <p className="text-sm text-muted-foreground">
                      Assine agora e tenha acesso à telemedicina e muito mais!
                    </p>
                  </div>
                </div>
                <Button
                  className="gradient-hero"
                  onClick={() => navigate("/planos")}
                >
                  Ver planos
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading font-semibold text-foreground">
              Meus Receituários
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => navigate("/prescriptions")}
            >
              Ver todos
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {prescriptions.length > 0 ? (
              prescriptions.map((prescription) => (
                <Card
                  key={prescription.id}
                  className="bg-card border-border/50 cursor-pointer transition-all hover:shadow-card hover:border-primary/20"
                  onClick={() => navigate(`/prescription/${prescription.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{prescription.id}</CardTitle>
                      </div>
                      {getStatusBadge(prescription.status)}
                    </div>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {prescription.patient_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(prescription.date).toLocaleDateString("pt-BR")}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Médico</p>
                        <p className="text-sm font-medium">{prescription.doctor_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Medicamentos</p>
                        <p className="text-sm font-medium">{prescription.medications?.length || 0} itens</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="col-span-full bg-card border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center mb-4">
                    Você ainda não possui receitas cadastradas
                  </p>
                  <Button onClick={() => navigate("/prescriptions")}>
                    Buscar Receita
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-heading font-semibold text-foreground mb-4">
            Atividade Recente
          </h2>
          <Card className="bg-card border-border/50">
            <CardContent className="p-0 divide-y divide-border/50">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => (
                  <div key={activity.id || index} className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                      {activity.icon === "Video" && <Video className="h-5 w-5 text-muted-foreground" />}
                      {activity.icon === "FileText" && <FileText className="h-5 w-5 text-muted-foreground" />}
                      {activity.icon === "Pill" && <Pill className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {activity.time}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center p-8 text-muted-foreground">
                  <p>Nenhuma atividade recente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
