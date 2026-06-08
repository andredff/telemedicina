import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, FileText, ShoppingCart, Pill, User, Calendar,
  ChevronRight, Loader2, Package, ExternalLink, XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { SearchClient } from "@/integrations/supabase/searchClient";
import { logger } from "@/lib/logger";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { PrescriptionMedicationsModal } from "@/components/prescription/PrescriptionMedicationsModal";
import { extractTextFromUrl } from "@/services/prescriptionParserService";

// ── Types ──────────────────────────────────────────────────────────────────

interface Prescription {
  id: string;
  patient_name: string;
  doctor_name: string;
  doctor_crm: string;
  date: string;
  status: string;
}

// ── Component ──────────────────────────────────────────────────────────────

const Farmacia = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  // Auth
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Prescription search (by consultation ID)
  const [consultationId, setConsultationId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentPrescriptions, setRecentPrescriptions] = useState<Prescription[]>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [receituarios, setReceituarios] = useState<{ urlPdf: string; isPedidoExame: boolean }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReceituario, setSelectedReceituario] = useState<{ urlPdf: string; index: number } | null>(null);

  // Pedidos rejeitados (por consulta_id) para cruzar com receituários
  const [rejectedOrders, setRejectedOrders] = useState<Record<string, { notes: string | null; payment_status: string | null }>>({});

  // Cart
  const cart = useCart();

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadRecentPrescriptions();
      loadRejectedOrders();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Prescription ID autocomplete (busca por consultation_id) ───────────────────────

  useEffect(() => {
    if (consultationId.length > 1) {
      SearchClient.getSearchSuggestions(consultationId)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    } else {
      setSuggestions([]);
    }
  }, [consultationId]);

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadRecentPrescriptions = async () => {
    if (!user) return;
    setLoadingPrescriptions(true);
    try {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("id, patient_name, doctor_name, doctor_crm, date, status")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(5);
      if (error) throw error;
      setRecentPrescriptions(data ?? []);
    } catch (err) {
      logger.error("Error loading prescriptions:", err);
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  const loadRejectedOrders = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("orders")
        .select("consulta_id, receita_review_notes, payment_status")
        .eq("user_id", user.id)
        .eq("status", "cancelled")
        .eq("receita_review_status", "rejected")
        .not("consulta_id", "is", null);
      if (data) {
        const map: Record<string, { notes: string | null; payment_status: string | null }> = {};
        for (const o of data) {
          if (o.consulta_id) map[String(o.consulta_id)] = { notes: o.receita_review_notes, payment_status: o.payment_status };
        }
        setRejectedOrders(map);
      }
    } catch (err) {
      logger.error("Erro ao carregar pedidos rejeitados:", err);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSearch = async () => {
    if (!consultationId.trim()) {
      toast({ title: "ID da consulta obrigatório", description: "Insira o ID da sua consulta para buscar a receita.", variant: "destructive" });
      return;
    }
    setIsSearching(true);
    setReceituarios([]);
    try {
      const items: { urlPdf: string }[] = [];
      setIsSearching(false);
      if (items && items.length > 0) {
        // Se vier mais de 1 PDF, tenta detectar "PEDIDO DE EXAME" no texto de cada um
        let classified: { urlPdf: string; isPedidoExame: boolean }[];
        if (items.length > 1) {
          classified = await Promise.all(
            items.map(async (item) => {
              try {
                const text = await extractTextFromUrl(item.urlPdf);
                const isPedidoExame = !!text && /pedido\s*de\s*exame/i.test(text);
                return { urlPdf: item.urlPdf, isPedidoExame };
              } catch {
                return { urlPdf: item.urlPdf, isPedidoExame: false };
              }
            })
          );
        } else {
          classified = items.map((item) => ({ urlPdf: item.urlPdf, isPedidoExame: false }));
        }
        setReceituarios(classified);
      } else {
        toast({ title: "Receita não encontrada", description: "Nenhuma receita encontrada para este ID de consulta." });
      }
    } catch (err) {
      logger.error("Prescription search error:", err);
      setIsSearching(false);
      toast({ title: "Erro na busca", description: "Tente novamente.", variant: "destructive" });
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const cartCount = cart.items.reduce((s, e) => s + e.quantity, 0);
  const cartTotal = cart.items.reduce((s, e) => s + e.price * e.quantity, 0);

  const getStatusColor = (status: string) => ({
    pending: "bg-yellow-500", completed: "bg-green-500", cancelled: "bg-red-500",
  }[status] ?? "bg-gray-500");

  const getStatusText = (status: string) => ({
    pending: "Pendente", completed: "Concluída", cancelled: "Cancelada",
  }[status] ?? status);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} title="Farmácia" />

      <main className="page-container pb-28">
        {/* Back + cart counter row */}
        <div className="flex items-center justify-between">
          <BackLink to="/dashboard" label="Voltar ao Dashboard" />
          {cartCount > 0 && (
            <button
              onClick={() => navigate("/cart")}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartCount} item{cartCount !== 1 ? "s" : ""} · R$ {cartTotal.toFixed(2).replace(".", ",")}
            </button>
          )}
        </div>

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary mb-1">
            Farmácia Online
          </h1>
          <p className="text-muted-foreground">
            Localize sua receita médica
          </p>
        </div>

        {/* ── Buscar Receita por ID da Consulta ──────────────────────────── */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Search className="h-4 w-4 text-primary" />
              </div>
              Buscar Receita
            </CardTitle>
            <CardDescription>
              Digite o ID da consulta recebido após sua teleconsulta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder="Ex: 12345"
                  value={consultationId}
                  onChange={(e) => setConsultationId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 hover:bg-muted cursor-pointer text-sm"
                        onClick={() => { setConsultationId(suggestion); setSuggestions([]); }}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="gap-2">
                {isSearching ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Buscando...</>
                ) : (
                  <><Search className="h-4 w-4" />Buscar</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Resultados do Receituário ─────────────────────────────────── */}
        {receituarios.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                Receituários encontrados
              </CardTitle>
              <CardDescription>Consulta #{consultationId}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {receituarios.map((item, i) => {
                  const rejected = rejectedOrders[consultationId.trim()];
                  const isExame = item.isPedidoExame;
                  return (
                    <div key={i} className="space-y-2">
                      <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border bg-muted/20 ${isExame ? "border-blue-200 bg-blue-50/40" : "border-border/50"}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isExame ? "bg-blue-100" : "bg-primary/10"}`}>
                            <FileText className={`h-4 w-4 ${isExame ? "text-blue-600" : "text-primary"}`} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-foreground">
                              {isExame ? "Pedido de Exame" : `Receituário${receituarios.length > 1 ? ` #${i + 1}` : ""}`}
                            </span>
                            {isExame && (
                              <p className="text-xs text-blue-600 mt-0.5">Documento de solicitação de exames</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 sm:shrink-0">
                          {isExame ? (
                            <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700" asChild>
                              <a href={item.urlPdf} target="_blank" rel="noopener noreferrer" download>
                                <ExternalLink className="h-3.5 w-3.5" />
                                Baixar Pedido de Exame
                              </a>
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                                <a href={item.urlPdf} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Abrir PDF
                                </a>
                              </Button>
                              {!rejected && (
                                <Button
                                  size="sm"
                                  className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => { setSelectedReceituario({ urlPdf: item.urlPdf, index: i }); setModalOpen(true); }}
                                >
                                  <Pill className="h-3.5 w-3.5" />
                                  Adquirir medicamentos
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {rejected && !isExame && (
                        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                          <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-red-700">Pedido rejeitado pela farmácia</p>
                            {rejected.notes && <p className="text-sm text-red-600">{rejected.notes}</p>}
                            <p className="text-xs text-red-500 mt-0.5">
                              {rejected.payment_status === 'refunded'
                                ? 'Estorno realizado — valor creditado em até 5 dias úteis.'
                                : 'O reembolso será processado em breve.'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Minhas Receitas */}
          <button
            className="group text-left bg-card border border-border/50 rounded-2xl p-6 flex items-center gap-4 shadow-md hover:shadow-lg hover:border-primary/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            onClick={() => navigate("/prescriptions")}
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Minhas Receitas</p>
              <p className="text-xs text-muted-foreground mt-1">Ver todas as receitas</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
          </button>

          {/* Meu Carrinho */}
          <button
            className="group text-left bg-card border border-border/50 rounded-2xl p-6 flex items-center gap-4 shadow-md hover:shadow-lg hover:border-emerald-300 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            onClick={() => navigate("/cart")}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 relative group-hover:bg-emerald-500/15 transition-colors">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Meu Carrinho</p>
              <p className="text-xs text-muted-foreground mt-1">
                {cartCount > 0
                  ? <span className="text-emerald-700 font-medium">{cartCount} item{cartCount !== 1 ? "s" : ""} · R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
                  : "Ver itens selecionados"
                }
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-emerald-600 transition-colors" />
          </button>

          {/* Meus Pedidos */}
          <button
            className="group text-left bg-card border border-border/50 rounded-2xl p-6 flex items-center gap-4 shadow-md hover:shadow-lg hover:border-orange-300 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50"
            onClick={() => navigate("/orders")}
          >
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:bg-orange-500/15 transition-colors">
              <Package className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Meus Pedidos</p>
              <p className="text-xs text-muted-foreground mt-1">Acompanhar entregas</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-orange-500 transition-colors" />
          </button>
        </div>

        {/* ── Receitas Recentes ─────────────────────────────────────────── */}
        {/* <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  Receitas Recentes
                </CardTitle>
                <CardDescription className="mt-1 ml-10">Suas últimas receitas médicas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPrescriptions ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : recentPrescriptions.length > 0 ? (
              <div className="space-y-3">
                {recentPrescriptions.map((prescription) => (
                  <div
                    key={prescription.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/40 hover:border-border cursor-pointer transition-all group"
                    onClick={() => navigate(`/prescription/${prescription.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{prescription.id}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1 truncate">
                            <User className="h-3 w-3 shrink-0" />{prescription.doctor_name}
                          </span>
                          <span className="shrink-0">·</span>
                          <span className="flex items-center gap-1 shrink-0">
                            <Calendar className="h-3 w-3" />
                            {new Date(prescription.date).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <Badge className={`${getStatusColor(prescription.status)} text-white text-[11px] px-2.5 py-0.5`}>
                        {getStatusText(prescription.status)}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-foreground">Nenhuma receita encontrada</p>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Suas receitas aparecerão aqui após suas consultas
                </p>
              </div>
            )}
          </CardContent>
        </Card> */}
      </main>

      {selectedReceituario && (
        <PrescriptionMedicationsModal
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setSelectedReceituario(null);
          }}
          prescriptionPdfUrl={selectedReceituario.urlPdf}
          prescriptionTitle={
            receituarios.length > 1
              ? `Receituário #${selectedReceituario.index + 1} — Consulta #${consultationId}`
              : `Receituário — Consulta #${consultationId}`
          }
          consultationId={Number(consultationId)}
          onCartUpdated={(count) => {
            if (count > 0) toast({ title: "Carrinho atualizado", description: `${count} item${count !== 1 ? "s" : ""} no carrinho.` });
          }}
        />
      )}

      <ActiveConsultationBanner />
    </div>
  );
};

export default Farmacia;
