import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import {
  FileText, Calendar, ChevronRight, Video, Pill, Crown,
  Stethoscope, ArrowRight, Sparkles, Package, HeartPulse,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RBAC } from "@/integrations/supabase/adminClient";
import { logger } from "@/lib/logger";
import { getPlanColor } from "@/data/plansData";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SupportFAB from "@/components/SupportFAB";

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

// ─── Time-based greeting ─────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session) {
          navigate("/auth");
        } else if (session.user) {
          fetchProfile(session.user.id);
          fetchSubscription(session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
      } else if (session.user) {
        // Role-based redirect: doctors and admins go to their panels
        const role = await RBAC.getUserRole(session.user.id);
        if (role === RBAC.ROLES.DOCTOR) {
          navigate("/medico");
          return;
        }
        if (role === RBAC.ROLES.ADMIN) {
          navigate("/admin");
          return;
        }
        fetchProfile(session.user.id);
        fetchSubscription(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const firstName = (profile?.full_name || user?.user_metadata?.full_name || "Paciente").split(" ")[0];
  const greeting = getGreeting();

  const formatExpirationDate = (dateStr: string | null) => {
    if (!dateStr) return "Sem data definida";
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  const getPlanDescription = () => {
    if (!subscription?.plan) return "Você ainda não possui um plano ativo";
    return subscription.plan.description || "Consultas ilimitadas com clínico geral";
  };

  const quickActions = [
    {
      label: "Consulta Imediata",
      sublabel: "Clínico geral 24h",
      icon: Video,
      color: "text-primary",
      bg: "bg-primary/10 group-hover:bg-primary/20",
      route: "/teleconsultas",
    },
    {
      label: "Especialista",
      sublabel: "Agendar consulta",
      icon: Stethoscope,
      color: "text-accent",
      bg: "bg-accent/10 group-hover:bg-accent/20",
      route: "/especialistas",
    },
    {
      label: "Check-ups",
      sublabel: "Saldo e histórico",
      icon: HeartPulse,
      color: "text-rose-500",
      bg: "bg-rose-500/10 group-hover:bg-rose-500/20",
      route: "/meus-checkups",
    },
    {
      label: "Farmácia",
      sublabel: "Entrega em casa",
      icon: Pill,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10 group-hover:bg-emerald-500/20",
      route: "/farmacia",
    },
    {
      label: "Meus Pedidos",
      sublabel: "Acompanhar entregas",
      icon: Package,
      color: "text-orange-500",
      bg: "bg-orange-500/10 group-hover:bg-orange-500/20",
      route: "/orders",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />

      <main className="page-container">

        {/* ── Greeting ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-0.5">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-primary">
              {greeting}, {firstName}!
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Como podemos te ajudar hoje?
            </p>
          </div>
        </div>

        {/* ── Plan Hero ────────────────────────────────────────────────── */}
        {subscription?.plan ? (
          <div className={`rounded-2xl p-6 sm:p-8 text-primary-foreground bg-gradient-to-br ${getPlanColor(subscription.plan.type)} shadow-lg`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Crown className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white/70 uppercase tracking-wider mb-1">Seu plano ativo</p>
                  <h2 className="text-xl sm:text-2xl font-heading font-bold text-white">
                    Plano {subscription.plan.name}
                  </h2>
                  <p className="text-sm text-white/80 mt-1">{getPlanDescription()}</p>
                  <p className="text-xs text-white/60 mt-1">
                    Válido até {formatExpirationDate(subscription.expires_at)}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-0 shrink-0 gap-2 backdrop-blur-sm"
                onClick={() => navigate("/meu-plano")}
              >
                <Sparkles className="h-4 w-4" />
                Fazer upgrade
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-heading font-bold text-primary">
                    Você ainda não tem um plano
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Assine agora e tenha acesso à telemedicina e muito mais.
                  </p>
                </div>
              </div>
              <Button
                className="gradient-hero gap-2 shrink-0"
                onClick={() => navigate("/planos")}
              >
                Ver planos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <div>
          <p className="section-title">Acesso rápido</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            {quickActions.map(({ label, sublabel, icon: Icon, color, bg, route }) => (
              <button
                key={route}
                className="group text-left bg-card border border-border/50 rounded-xl p-3 sm:p-4 flex flex-col gap-2 hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onClick={() => navigate(route)}
              >
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center transition-colors group-hover:scale-105 duration-200`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground leading-tight">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{sublabel}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Receituários ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-heading font-bold text-primary leading-tight">
                Meus Receituários
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Últimas prescrições das suas consultas</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary gap-1"
              onClick={() => navigate("/prescriptions")}
            >
              Ver todos
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col items-center justify-center py-14 rounded-xl border border-dashed border-border bg-muted/30">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground mb-1">Nenhum receituário ainda</p>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-xs">
              Seus receituários aparecerão aqui após consultas realizadas.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("/prescriptions")}>
              Ver receituários
            </Button>
          </div>
        </div>

      </main>

      <ActiveConsultationBanner />

      <SupportFAB />
    </div>
  );
};

export default Dashboard;
