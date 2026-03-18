import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import {
  FileText,
  Calendar,
  ChevronRight,
  Video,
  Pill,
  Package,
  Crown,
  Download,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getPlanColor } from "@/data/plansData";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizeConsultationStatus } from "@/integrations/assemed/types";

import { useToast } from "@/hooks/use-toast";

interface AssemedReceituario {
  consultationId: number;
  especialidade: string;
  profissional: string | null;
  data: string;
  urlPdf: string;
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
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [receituarios, setReceituarios] = useState<AssemedReceituario[]>([]);
  const [loadingReceituarios, setLoadingReceituarios] = useState(true);

  const { accessToken: assemedAccessToken } = useAssemedToken();

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

  const fetchReceituarios = async (token: string) => {
    setLoadingReceituarios(true);
    try {
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setAccessToken(token);

      const response = await assemedClient.getConsultations(20, 0);
      const consultations = (response.items || []).filter(
        c => normalizeConsultationStatus(c) !== "CANCELADO"
      );

      const results = await Promise.allSettled(
        consultations.map(async (c) => {
          const items = await assemedClient.getReceituarios(c.id);
          return { consultation: c, items };
        })
      );

      const found: AssemedReceituario[] = [];
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const { consultation, items } = result.value;
        for (const item of items) {
          if (item.urlPdf) {
            found.push({
              consultationId: consultation.id,
              especialidade: consultation.especialidadeNome || "Consulta",
              profissional: consultation.profissionalNome || null,
              data: consultation.dataHoraFim || consultation.dataHoraCriacao || consultation.dataCriacao,
              urlPdf: item.urlPdf,
            });
            break; // um por consulta no dashboard
          }
        }
        if (found.length >= 3) break;
      }

      setReceituarios(found);
    } catch (err) {
      logger.error("Error fetching receituarios:", err);
    } finally {
      setLoadingReceituarios(false);
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
      } else if (session.user) {
        fetchProfile(session.user.id);
        fetchSubscription(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (assemedAccessToken) {
      fetchReceituarios(assemedAccessToken);
    } else {
      setLoadingReceituarios(false);
    }
  }, [assemedAccessToken]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

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
            onClick={() => navigate("/teleconsultas")}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Consulta Imediata</p>
                <p className="text-xs text-muted-foreground">Clínico geral 24h</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all cursor-pointer group"
            onClick={() => navigate("/especialistas")}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <Calendar className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="font-medium text-foreground">Consulta com</p>
                <p className="text-xs text-muted-foreground">Especialista</p>
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
          <Card className={`mb-8 border-0 text-primary-foreground bg-gradient-to-br ${getPlanColor(subscription.plan.type)}`}>
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
            {loadingReceituarios ? (
              <Card className="col-span-full bg-card border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                  <p className="text-muted-foreground text-sm">Buscando receituários...</p>
                </CardContent>
              </Card>
            ) : receituarios.length > 0 ? (
              receituarios.map((rec) => (
                <Card
                  key={rec.consultationId}
                  className="bg-card border-border/50 transition-all hover:shadow-card hover:border-primary/20"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Consulta #{rec.consultationId}</CardTitle>
                      </div>
                      <Badge className="bg-green-100 text-green-700 border-green-200">Concluída</Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1 mt-2">
                      <Calendar className="h-3.5 w-3.5" />
                      {(() => {
                        try { return format(new Date(rec.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
                        catch { return rec.data; }
                      })()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Especialidade</p>
                        <p className="text-sm font-medium">{rec.especialidade}</p>
                      </div>
                      {rec.profissional && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Profissional</p>
                          <p className="text-sm font-medium">{rec.profissional}</p>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => window.open(rec.urlPdf, "_blank")}
                    >
                      <Download className="h-4 w-4" />
                      Baixar Receituário
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="col-span-full bg-card border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center mb-4">
                    Nenhum receituário disponível
                  </p>
                  <Button variant="outline" onClick={() => navigate("/prescriptions")}>
                    Ver receituários
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

      </main>

      {/* Floating consultation banner */}
      <ActiveConsultationBanner accessToken={assemedAccessToken} />
    </div>
  );
};

export default Dashboard;
