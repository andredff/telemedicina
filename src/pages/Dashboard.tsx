import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/Header";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import {
  FileText, Calendar, ChevronRight, Video, Pill, Package, Crown,
  Download, Loader2, ShoppingCart, Star, AlertTriangle, CheckCircle2,
  Search, Upload, Stethoscope, ArrowRight, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getPlanColor } from "@/data/plansData";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizeConsultationStatus } from "@/integrations/assemed/types";
import { useToast } from "@/hooks/use-toast";
import {
  extractTextFromUrl,
  extractTextFromFile,
  matchMedicationsInText,
  type MatchedMedication,
} from "@/services/prescriptionParserService";
import type { MedicationCatalog } from "@/types/inventory";

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

// ─── Cart helpers ────────────────────────────────────────────────────────────
interface CartEntry { cartItemId: string; name: string; dosage: string; price: number; quantity: number; }
function loadCart(): CartEntry[] { try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; } }
function saveCart(c: CartEntry[]) { localStorage.setItem("cart", JSON.stringify(c)); }

// ─── Time-based greeting ─────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
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

  // ── Parser state ──────────────────────────────────────────────────────────
  const [parserOpen, setParserOpen]       = useState(false);
  const [parserRec, setParserRec]         = useState<AssemedReceituario | null>(null);
  const [parserLoading, setParserLoading] = useState(false);
  const [parserStep, setParserStep]       = useState<"loading" | "results" | "manual">("loading");
  const [matchedMeds, setMatchedMeds]     = useState<MatchedMedication[]>([]);
  const [manualText, setManualText]       = useState("");
  const [addedIds, setAddedIds]           = useState<Set<string>>(new Set());
  const [cartCount, setCartCount]         = useState(() => loadCart().length);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { accessToken: assemedAccessToken } = useAssemedToken();

  const handleAnalyze = async (rec: AssemedReceituario) => {
    setParserRec(rec);
    setParserStep("loading");
    setParserOpen(true);
    setMatchedMeds([]);
    setManualText("");
    setParserLoading(true);
    const text = await extractTextFromUrl(rec.urlPdf);
    if (text && text.trim().length > 20) {
      setMatchedMeds(await matchMedicationsInText(text));
      setParserStep("results");
    } else {
      setParserStep("manual");
    }
    setParserLoading(false);
  };

  const handleManualAnalyze = async () => {
    if (!manualText.trim()) return;
    setParserLoading(true);
    setMatchedMeds(await matchMedicationsInText(manualText));
    setParserStep("results");
    setParserLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParserLoading(true);
    const text = await extractTextFromFile(file);
    if (text && text.trim().length > 20) {
      setMatchedMeds(await matchMedicationsInText(text));
      setParserStep("results");
    } else {
      toast({ title: "Não foi possível extrair texto do PDF", description: "Cole o texto manualmente abaixo.", variant: "destructive" });
    }
    setParserLoading(false);
  };

  const addToCart = (med: MedicationCatalog) => {
    const cart = loadCart();
    const existing = cart.find(i => i.cartItemId === med.id);
    if (existing) { existing.quantity += 1; } else {
      cart.push({ cartItemId: med.id, name: med.name, dosage: med.dosage || "", price: med.price, quantity: 1 });
    }
    saveCart(cart);
    setAddedIds(prev => new Set([...prev, med.id]));
    setCartCount(cart.length);
    toast({ title: `${med.name} adicionado ao carrinho` });
    setTimeout(() => setAddedIds(prev => { const s = new Set(prev); s.delete(med.id); return s; }), 1500);
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">

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
          <h2 className="text-base font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Acesso rápido
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {quickActions.map(({ label, sublabel, icon: Icon, color, bg, route }) => (
              <Card
                key={route}
                className="bg-card border-border/50 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
                onClick={() => navigate(route)}
              >
                <CardContent className="p-4 sm:p-5 flex flex-col items-center text-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center transition-colors`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground leading-tight">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ── Receituários ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-heading font-semibold text-foreground">
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
              receituarios.map((rec) => (
                <Card
                  key={rec.consultationId}
                  className="bg-card border-border/50 transition-all hover:shadow-md hover:border-primary/20 flex flex-col"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-sm font-semibold">
                          Consulta #{rec.consultationId}
                        </CardTitle>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] shrink-0">
                        Concluída
                      </Badge>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {(() => {
                        try { return format(new Date(rec.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
                        catch { return rec.data; }
                      })()}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 justify-between gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Especialidade</p>
                        <p className="text-sm font-medium mt-0.5">{rec.especialidade}</p>
                      </div>
                      {rec.profissional && (
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Profissional</p>
                          <p className="text-sm font-medium mt-0.5 max-w-[120px] truncate" title={rec.profissional}>
                            {rec.profissional}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-xs"
                        onClick={() => window.open(rec.urlPdf, "_blank")}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Baixar Receituário
                      </Button>
                      <Button
                        size="sm"
                        className="w-full gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleAnalyze(rec)}
                      >
                        <Pill className="h-3.5 w-3.5" />
                        Analisar Medicamentos
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
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


      {/* Modal de Análise de Medicamentos */}
      <Dialog open={parserOpen} onOpenChange={setParserOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-emerald-600" />
              Medicamentos Encontrados
              {parserRec && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  — Consulta #{parserRec.consultationId}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {parserLoading && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
              <p className="text-sm text-muted-foreground">Analisando receituário...</p>
            </div>
          )}

          {!parserLoading && parserStep === "manual" && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Não foi possível ler o PDF automaticamente.</p>
                  <p className="text-xs mt-1">Faça upload do arquivo ou cole o texto do receituário abaixo.</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" size="sm" className="gap-2 w-full" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />Fazer upload do PDF
              </Button>
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium">Ou cole o texto do receituário:</label>
                <Textarea
                  placeholder={"Ex: Dipirona 500mg — tomar 1x ao dia\nAmoxicilina 500mg — 1 cápsula a cada 8h..."}
                  rows={5}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                />
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                  disabled={!manualText.trim() || parserLoading}
                  onClick={handleManualAnalyze}
                >
                  <Search className="h-4 w-4" />Identificar Medicamentos
                </Button>
              </div>
            </div>
          )}

          {!parserLoading && parserStep === "results" && (
            <div className="space-y-4">
              {matchedMeds.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <p className="text-muted-foreground">Nenhum medicamento do catálogo encontrado nesta receita.</p>
                  <Button variant="outline" size="sm" onClick={() => setParserStep("manual")}>Tentar manualmente</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span><strong>{matchedMeds.length}</strong> medicamento{matchedMeds.length > 1 ? "s" : ""} disponíve{matchedMeds.length > 1 ? "is" : "l"} na farmácia.</span>
                  </div>
                  <div className="space-y-2">
                    {matchedMeds.map(({ medication: med, confidence }) => (
                      <div key={med.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{med.name}</p>
                            {confidence === "high" && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-4 gap-0.5">
                                <Star className="h-2.5 w-2.5" />Prescrito
                              </Badge>
                            )}
                          </div>
                          {med.active_ingredient && <p className="text-xs text-muted-foreground">{med.active_ingredient}</p>}
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {med.dosage && <span className="text-xs text-muted-foreground">{med.dosage}</span>}
                            {med.pharmacy_name && <span className="text-xs text-primary/70">· {med.pharmacy_name}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="font-bold text-sm">R$ {med.price.toFixed(2)}</p>
                            <p className={`text-[10px] ${med.stock > 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {med.stock > 0 ? "Em estoque" : "Sem estoque"}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            disabled={med.stock === 0}
                            className={`gap-1.5 text-xs transition-all ${addedIds.has(med.id) ? "bg-emerald-600 text-white" : ""}`}
                            onClick={() => addToCart(med)}
                          >
                            {addedIds.has(med.id)
                              ? <><CheckCircle2 className="h-3.5 w-3.5" />Adicionado</>
                              : <><ShoppingCart className="h-3.5 w-3.5" />Adicionar</>}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {cartCount > 0 && (
                    <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/cart")}>
                      <ShoppingCart className="h-4 w-4" />Ver carrinho ({cartCount} {cartCount === 1 ? "item" : "itens"})
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setParserStep("manual")}>
                    Não encontrou? Buscar manualmente
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
