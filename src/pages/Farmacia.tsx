import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, FileText, ShoppingCart, Pill, User, Calendar,
  ChevronRight, Loader2, Store, Truck, Star, Package,
  Plus, Minus, X, CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SearchClient } from "@/integrations/supabase/searchClient";
import { logger } from "@/lib/logger";
import { getMedicationCatalog } from "@/services/inventoryService";
import { MedicationCatalog } from "@/types/inventory";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────

interface Prescription {
  id: string;
  patient_name: string;
  doctor_name: string;
  doctor_crm: string;
  date: string;
  status: string;
}

interface CartEntry {
  cartItemId: string;
  medication_id: string;
  name: string;
  dosage: string | null;
  price: number;
  pharmacy_id: string | null;
  pharmacy_name: string;
  quantity: number;
}

// ── Cart helpers ───────────────────────────────────────────────────────────

function loadCart(): CartEntry[] {
  try { return JSON.parse(localStorage.getItem("cart") ?? "[]"); } catch { return []; }
}

function saveCart(cart: CartEntry[]) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

// ── Component ──────────────────────────────────────────────────────────────

const Farmacia = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { accessToken: assemedAccessToken } = useAssemedToken();

  // Auth
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Prescription search (existing)
  const [prescriptionCode, setPrescriptionCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentPrescriptions, setRecentPrescriptions] = useState<Prescription[]>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);

  // Medication search (new)
  const [medSearch, setMedSearch] = useState("");
  const [medResults, setMedResults] = useState<MedicationCatalog[]>([]);
  const [medLoading, setMedLoading] = useState(false);
  const [prescribedNames, setPrescribedNames] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Cart
  const [cart, setCart] = useState<CartEntry[]>(loadCart());

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
    if (user) loadRecentPrescriptions();
  }, [user]);

  // ── Prescription code autocomplete ───────────────────────────────────────

  useEffect(() => {
    if (prescriptionCode.length > 1) {
      SearchClient.getSearchSuggestions(prescriptionCode)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    } else {
      setSuggestions([]);
    }
  }, [prescriptionCode]);

  // ── Medication debounced search ───────────────────────────────────────────

  useEffect(() => {
    if (medSearch.trim().length < 2) {
      setMedResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setMedLoading(true);
      try {
        const results = await getMedicationCatalog({ search: medSearch.trim() });
        setMedResults(results);
      } catch (err) {
        logger.error("Medication search error:", err);
      } finally {
        setMedLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [medSearch]);

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
      const prescriptions = data ?? [];
      setRecentPrescriptions(prescriptions);

      // Load prescribed medication names for highlighting
      if (prescriptions.length > 0) {
        const { data: meds } = await supabase
          .from("medications")
          .select("name")
          .in("prescription_id", prescriptions.map((p) => p.id));
        setPrescribedNames((meds ?? []).map((m: { name: string }) => m.name.toLowerCase()));
      }
    } catch (err) {
      logger.error("Error loading prescriptions:", err);
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSearch = async () => {
    if (!prescriptionCode.trim()) {
      toast({ title: "Código obrigatório", description: "Insira o código da sua receita.", variant: "destructive" });
      return;
    }
    setIsSearching(true);
    try {
      const prescription = await SearchClient.getPrescriptionById(prescriptionCode.toUpperCase());
      setIsSearching(false);
      if (prescription) {
        navigate(`/prescription/${prescription.id}`);
      } else {
        toast({ title: "Receita não encontrada", description: "Verifique o código e tente novamente." });
      }
    } catch (err) {
      logger.error("Prescription search error:", err);
      setIsSearching(false);
      toast({ title: "Erro na busca", description: "Tente novamente.", variant: "destructive" });
    }
  };

  // ── Cart helpers ──────────────────────────────────────────────────────────

  const addToCart = useCallback((med: MedicationCatalog) => {
    const current = loadCart();
    const existing = current.find((e) => e.medication_id === med.id);
    const next: CartEntry[] = existing
      ? current.map((e) => e.medication_id === med.id ? { ...e, quantity: e.quantity + 1 } : e)
      : [...current, {
          cartItemId: crypto.randomUUID(),
          medication_id: med.id,
          name: med.name,
          dosage: med.dosage,
          price: med.price,
          pharmacy_id: med.pharmacy_id,
          pharmacy_name: med.pharmacy_name ?? "Farmácia",
          quantity: 1,
        }];
    saveCart(next);
    setCart(next);
    setAddedIds((s) => new Set(s).add(med.id));
    setTimeout(() => setAddedIds((s) => { const n = new Set(s); n.delete(med.id); return n; }), 1500);
    toast({ title: "Adicionado ao carrinho!", description: med.name });
  }, [toast]);

  const removeFromCart = useCallback((medId: string) => {
    const next = loadCart().filter((e) => e.medication_id !== medId);
    saveCart(next);
    setCart(next);
  }, []);

  const updateQty = useCallback((medId: string, delta: number) => {
    const next = loadCart()
      .map((e) => e.medication_id === medId ? { ...e, quantity: Math.max(0, e.quantity + delta) } : e)
      .filter((e) => e.quantity > 0);
    saveCart(next);
    setCart(next);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const isPrescribed = (med: MedicationCatalog) =>
    prescribedNames.some((n) =>
      med.name.toLowerCase().includes(n) || (med.active_ingredient ?? "").toLowerCase().includes(n)
    );

  const cartQty = (medId: string) => cart.find((e) => e.medication_id === medId)?.quantity ?? 0;
  const cartCount = cart.reduce((s, e) => s + e.quantity, 0);
  const cartTotal = cart.reduce((s, e) => s + e.price * e.quantity, 0);

  const getStatusColor = (status: string) => ({
    pending: "bg-yellow-500", completed: "bg-green-500", cancelled: "bg-red-500",
  }[status] ?? "bg-gray-500");

  const getStatusText = (status: string) => ({
    pending: "Pendente", completed: "Concluída", cancelled: "Cancelada",
  }[status] ?? status);

  const searchActive = medSearch.trim().length >= 2;

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

      <main className="container mx-auto px-4 py-8 pb-28">
        {/* Back + cart counter row */}
        <div className="flex items-center justify-between mb-2">
          <BackLink />
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
        <div className="mb-6">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-1">
            Farmácia Online
          </h1>
          <p className="text-muted-foreground">
            Busque medicamentos ou localize sua receita médica
          </p>
        </div>

        {/* ── NEW: Buscar Medicamentos ──────────────────────────────────── */}
        <Card className="mb-6 border-primary/20 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pill className="h-5 w-5 text-primary" />
              Buscar Medicamentos
            </CardTitle>
            <CardDescription>
              Pesquise por nome ou princípio ativo e adicione direto ao carrinho
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search input */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9 pr-9"
                placeholder="Ex: Dipirona, Amoxicilina, Ibuprofeno..."
                value={medSearch}
                onChange={(e) => setMedSearch(e.target.value)}
              />
              {medSearch && (
                <button
                  onClick={() => { setMedSearch(""); setMedResults([]); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Loading skeleton */}
            {medLoading && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="border rounded-xl p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-9 w-full mt-3" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!medLoading && searchActive && medResults.length === 0 && (
              <div className="mt-4 text-center py-10">
                <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground font-medium">Nenhum medicamento encontrado 😕</p>
                <p className="text-sm text-muted-foreground mt-1">Tente um nome diferente ou verifique a grafia</p>
              </div>
            )}

            {/* Results grid */}
            {!medLoading && medResults.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground mt-4 mb-3">
                  {medResults.length} resultado{medResults.length !== 1 ? "s" : ""} para &ldquo;{medSearch}&rdquo;
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {medResults.map((med) => {
                    const prescribed = isPrescribed(med);
                    const qty = cartQty(med.id);
                    const justAdded = addedIds.has(med.id);
                    const outOfStock = med.stock === 0;

                    return (
                      <div
                        key={med.id}
                        className={`border rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition-all bg-card ${
                          prescribed ? "ring-2 ring-blue-400 ring-offset-1" : ""
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {prescribed && (
                              <Badge className="mb-1 bg-blue-100 text-blue-700 border-blue-200 text-[10px] gap-1">
                                <Star className="h-2.5 w-2.5" />
                                Prescrito para você
                              </Badge>
                            )}
                            <p className="font-semibold text-foreground leading-tight">{med.name}</p>
                            {med.active_ingredient && (
                              <p className="text-xs text-muted-foreground mt-0.5">{med.active_ingredient}</p>
                            )}
                            {med.dosage && (
                              <p className="text-xs text-muted-foreground/70">{med.dosage}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-green-700">
                              R$ {med.price.toFixed(2).replace(".", ",")}
                            </p>
                            {outOfStock ? (
                              <p className="text-[10px] text-red-500 font-medium">Sem estoque</p>
                            ) : med.stock <= 10 ? (
                              <p className="text-[10px] text-amber-600">Só {med.stock} unidades</p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">{med.stock} disponíveis</p>
                            )}
                          </div>
                        </div>

                        {/* Pharmacy + delivery */}
                        {med.pharmacy_name && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Store className="h-3 w-3 shrink-0" />
                            <span className="truncate">{med.pharmacy_name}</span>
                            <Truck className="h-3 w-3 ml-auto shrink-0" />
                            <span className="shrink-0">2–5 dias</span>
                          </div>
                        )}

                        {/* Cart action */}
                        {outOfStock ? (
                          <Button size="sm" disabled variant="outline" className="w-full text-muted-foreground">
                            Indisponível
                          </Button>
                        ) : qty > 0 ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon" variant="outline" className="h-8 w-8 shrink-0"
                              onClick={() => updateQty(med.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="flex-1 text-center text-sm font-semibold">{qty}</span>
                            <Button
                              size="icon" variant="outline" className="h-8 w-8 shrink-0"
                              onClick={() => updateQty(med.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm" variant="ghost" className="text-destructive px-2 shrink-0"
                              onClick={() => removeFromCart(med.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className={`w-full gap-2 transition-all ${
                              justAdded ? "bg-green-600 hover:bg-green-700" : ""
                            }`}
                            onClick={() => addToCart(med)}
                          >
                            {justAdded ? (
                              <><CheckCircle2 className="h-4 w-4" />Adicionado!</>
                            ) : (
                              <><ShoppingCart className="h-4 w-4" />Adicionar ao carrinho</>
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Hint when search is empty */}
            {!searchActive && (
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Digite ao menos 2 caracteres para iniciar a busca
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── EXISTING: Buscar Receita ───────────────────────────────────── */}
        <Card className="mb-8 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Buscar Receita
            </CardTitle>
            <CardDescription>
              Digite o código da receita recebido por e-mail ou SMS após sua consulta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder="Ex: RX-2024-XXXXX"
                  value={prescriptionCode}
                  onChange={(e) => setPrescriptionCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 hover:bg-muted cursor-pointer text-sm"
                        onClick={() => { setPrescriptionCode(suggestion); setSuggestions([]); }}
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

        {/* ── EXISTING: Quick Actions ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/prescriptions")}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Minhas Receitas</p>
                <p className="text-sm text-muted-foreground">Ver todas as receitas</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/cart")}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center relative">
                <ShoppingCart className="h-6 w-6 text-accent" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">Meu Carrinho</p>
                <p className="text-sm text-muted-foreground">
                  {cartCount > 0 ? `${cartCount} item${cartCount !== 1 ? "s" : ""} · R$ ${cartTotal.toFixed(2).replace(".", ",")}` : "Ver itens selecionados"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/orders")}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-medical-green/10 flex items-center justify-center">
                <Pill className="h-6 w-6 text-medical-green" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Meus Pedidos</p>
                <p className="text-sm text-muted-foreground">Acompanhar entregas</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        {/* ── EXISTING: Recent Prescriptions ───────────────────────────── */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Receitas Recentes
            </CardTitle>
            <CardDescription>Suas últimas receitas médicas</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPrescriptions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : recentPrescriptions.length > 0 ? (
              <div className="space-y-3">
                {recentPrescriptions.map((prescription) => (
                  <div
                    key={prescription.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/prescription/${prescription.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{prescription.id}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />{prescription.doctor_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(prescription.date).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`${getStatusColor(prescription.status)} text-white`}>
                        {getStatusText(prescription.status)}
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma receita encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Suas receitas aparecerão aqui após suas consultas
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <ActiveConsultationBanner accessToken={assemedAccessToken} />
    </div>
  );
};

export default Farmacia;
