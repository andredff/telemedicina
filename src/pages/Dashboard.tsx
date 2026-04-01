import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/Header";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import {
  FileText, Calendar, ChevronRight, Video, Pill, Crown,
  Stethoscope, ArrowRight, Sparkles, Package, CheckCircle2,
  ShoppingCart, User, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getPlanColor } from "@/data/plansData";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizeConsultationStatus } from "@/integrations/assemed/types";
import { PrescriptionMedicationsModal } from "@/components/prescription/PrescriptionMedicationsModal";
import { usePaidPrescriptions } from "@/hooks/usePaidPrescriptions";
import { extractTextFromUrl } from "@/services/prescriptionParserService";
import SupportFAB from "@/components/SupportFAB";

interface AssemedReceituario {
  consultationId: number;
  especialidade: string;
  profissional: string | null;
  data: string;
  urlPdf: string;
  pedidoExameUrl: string | null;
  atestadoUrl: string | null;
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
  const [receituarios, setReceituarios] = useState<AssemedReceituario[]>([]);
  const [loadingReceituarios, setLoadingReceituarios] = useState(true);

  // ── Prescription modal state ───────────────────────────────────────────────
  const [medicModalOpen, setMedicModalOpen] = useState(false);
  const [selectedRec, setSelectedRec] = useState<AssemedReceituario | null>(null);

  const { accessToken: assemedAccessToken } = useAssemedToken();
  const { isPaid, markAsUnpaid } = usePaidPrescriptions();

  const openMedicModal = (rec: AssemedReceituario) => {
    setSelectedRec(rec);
    setMedicModalOpen(true);
  };

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
        const validItems = items.filter(i => i.urlPdf);
        if (validItems.length === 0) continue;

        // Classifica PDFs: pedido de exame vs atestado vs receita
        const classified = await Promise.all(
          validItems.map(async (item) => {
            if (validItems.length === 1) return { urlPdf: item.urlPdf, isPedidoExame: false, isAtestado: false };
            try {
              const text = await extractTextFromUrl(item.urlPdf);
              return {
                urlPdf: item.urlPdf,
                isPedidoExame: !!text && /pedido\s*de\s*exame/i.test(text),
                isAtestado: !!text && /atestado/i.test(text),
              };
            } catch {
              return { urlPdf: item.urlPdf, isPedidoExame: false, isAtestado: false };
            }
          })
        );

        const receita = classified.find(c => !c.isPedidoExame && !c.isAtestado) ?? classified[0];
        const pedidoExame = classified.find(c => c.isPedidoExame) ?? null;
        const atestado = classified.find(c => c.isAtestado) ?? null;

        found.push({
          consultationId: consultation.id,
          especialidade: consultation.especialidadeNome || "Consulta",
          profissional: consultation.profissionalNome || null,
          data: consultation.dataHoraFim || consultation.dataHoraCriacao || consultation.dataCriacao,
          urlPdf: receita.urlPdf,
          pedidoExameUrl: pedidoExame?.urlPdf ?? null,
          atestadoUrl: atestado?.urlPdf ?? null,
        });

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

  // Verifica pedidos rejeitados e libera o botão "Adquirir medicamentos"
  useEffect(() => {
    if (receituarios.length === 0) return;

    const checkRejectedOrders = async () => {
      const consultationIds = receituarios.map(r => String(r.consultationId));
      const { data } = await supabase
        .from("orders")
        .select("receita_id, receita_review_status")
        .in("receita_id", consultationIds)
        .eq("receita_review_status", "rejected");

      if (data && data.length > 0) {
        const rejectedIds = data.map(o => String(o.receita_id));
        markAsUnpaid(rejectedIds);
      }
    };

    checkRejectedOrders();
  }, [receituarios, markAsUnpaid]);

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
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
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
                  <h2 className="text-base sm:text-lg font-heading font-bold text-foreground">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {quickActions.map(({ label, sublabel, icon: Icon, color, bg, route }) => (
              <button
                key={route}
                className="group text-left bg-card border border-border/50 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onClick={() => navigate(route)}
              >
                <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center transition-colors group-hover:scale-105 duration-200`}>
                  <Icon className={`h-5 w-5 ${color}`} />
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
              <h2 className="text-base font-heading font-bold text-foreground leading-tight">
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loadingReceituarios ? (
              <>
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="bg-card border-border/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-5 rounded" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-36 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-full rounded-md" />
                      <Skeleton className="h-8 w-full rounded-md" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : receituarios.length > 0 ? (
              receituarios.map((rec) => {
                const pago = isPaid(rec.consultationId);
                const dataFormatada = (() => {
                  try { return format(new Date(rec.data), "dd/MM/yyyy", { locale: ptBR }); } catch { return rec.data; }
                })();
                const horaFormatada = (() => {
                  try { return format(new Date(rec.data), "HH:mm", { locale: ptBR }); } catch { return ""; }
                })();
                return (
                <Card
                  key={rec.consultationId}
                  className={`flex flex-col overflow-hidden border transition-all duration-200 hover:shadow-md ${
                    pago
                      ? "border-blue-200 bg-blue-50/30 hover:border-blue-300"
                      : "border-border/60 bg-card hover:border-primary/30"
                  }`}
                >
                  {/* Status bar */}
                  <div className={`h-1 w-full ${pago ? "bg-blue-400" : "bg-emerald-500"}`} />

                  <div className="p-4 flex flex-col flex-1 gap-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          pago ? "bg-blue-100" : "bg-primary/10"
                        }`}>
                          <FileText className={`h-4 w-4 ${pago ? "text-blue-600" : "text-primary"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground leading-tight">Receituário</p>
                          <p className="text-xs text-muted-foreground">#{rec.consultationId}</p>
                        </div>
                      </div>
                      <Badge className={`shrink-0 text-[10px] font-medium px-2 py-0.5 ${
                        pago
                          ? "bg-blue-100 text-blue-700 border-blue-200"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200"
                      }`}>
                        {pago
                          ? <><CheckCircle2 className="h-3 w-3 mr-1" />Adquirido</>
                          : <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />Disponível</>
                        }
                      </Badge>
                    </div>

                    {/* Info */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <Stethoscope className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-foreground font-medium truncate">{rec.especialidade}</span>
                      </div>
                      {rec.profissional && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{rec.profissional}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{dataFormatada}{horaFormatada && <span className="ml-1 opacity-70">· {horaFormatada}</span>}</span>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="mt-auto flex flex-col gap-2">
                      <Button
                        size="sm"
                        className={`w-full gap-2 h-9 text-sm font-medium transition-all ${
                          pago
                            ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                        disabled={pago}
                        onClick={() => openMedicModal(rec)}
                        variant="ghost"
                      >
                        {pago
                          ? <><CheckCircle2 className="h-4 w-4" />Medicamentos adquiridos</>
                          : <><ShoppingCart className="h-4 w-4" />Adquirir medicamentos</>
                        }
                      </Button>
                      {pago && rec.urlPdf && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2 h-9 text-sm font-medium border-slate-200 text-slate-600 hover:bg-slate-50"
                          asChild
                        >
                          <a href={rec.urlPdf} target="_blank" rel="noopener noreferrer">
                            <FileText className="h-4 w-4" />
                            Ver receita
                          </a>
                        </Button>
                      )}
                      {rec.pedidoExameUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2 h-9 text-sm font-medium border-violet-200 text-violet-700 hover:bg-violet-50"
                          asChild
                        >
                          <a href={rec.pedidoExameUrl} target="_blank" rel="noopener noreferrer" download>
                            <Download className="h-4 w-4" />
                            Baixar Pedido de Exame
                          </a>
                        </Button>
                      )}
                      {rec.atestadoUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2 h-9 text-sm font-medium border-teal-200 text-teal-700 hover:bg-teal-50"
                          asChild
                        >
                          <a href={rec.atestadoUrl} target="_blank" rel="noopener noreferrer" download>
                            <Download className="h-4 w-4" />
                            Baixar Atestado
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
                );
              })
            ) : (
              <div className="col-span-full">
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
            )}
          </div>
        </div>

      </main>

      {/* Floating consultation banner */}
      <ActiveConsultationBanner accessToken={assemedAccessToken} />


      <PrescriptionMedicationsModal
        open={medicModalOpen}
        onOpenChange={setMedicModalOpen}
        prescriptionPdfUrl={selectedRec?.urlPdf}
        prescriptionTitle={selectedRec ? `Consulta #${selectedRec.consultationId}` : undefined}
        consultationId={selectedRec?.consultationId}
      />

      <SupportFAB />
    </div>
  );
};

export default Dashboard;
