import { useState, useEffect, useMemo, useRef } from "react";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search, FileText, Loader2, Download, ExternalLink,
  Stethoscope,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizeConsultationStatus } from "@/integrations/assemed/types";
import { AssemedApiError } from "@/integrations/assemed/client";
import {
  extractTextFromUrl,
  extractTextFromFile,
  matchMedicationsInText,
  type MatchedMedication,
} from "@/services/prescriptionParserService";
import type { MedicationCatalog } from "@/types/inventory";

// Receituário vindo da API Assemed
interface AssemedReceituario {
  consultationId: number;
  especialidade: string;
  profissional: string | null;
  data: string;
  status: string;
  urlPdf: string;
}

// ─── Cart helpers ────────────────────────────────────────────────────────────
interface CartEntry { cartItemId: string; name: string; dosage: string; price: number; quantity: number; }

function loadCart(): CartEntry[] {
  try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
}
function saveCart(cart: CartEntry[]) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

const Prescriptions = () => {
  const { toast } = useToast();
  const { accessToken: assemedAccessToken, isLoading: assemedLoading } = useAssemedToken();
  const [searchTerm, setSearchTerm] = useState("");

  // Receituários vindos da API Assemed
  const [assemedReceituarios, setAssemedReceituarios] = useState<AssemedReceituario[]>([]);
  const [loadingReceituarios, setLoadingReceituarios] = useState(true);

  // Erro geral ao buscar receituários
  const [receituariosError, setReceituariosError] = useState<string | null>(null);

  // ── Parser state ──────────────────────────────────────────────────────────
  const [parserOpen, setParserOpen]         = useState(false);
  const [parserRec, setParserRec]           = useState<AssemedReceituario | null>(null);
  const [parserLoading, setParserLoading]   = useState(false);
  const [parserStep, setParserStep]         = useState<"loading" | "results" | "manual">("loading");
  const [matchedMeds, setMatchedMeds]       = useState<MatchedMedication[]>([]);
  const [manualText, setManualText]         = useState("");
  const [addedIds, setAddedIds]             = useState<Set<string>>(new Set());
  const [cartCount, setCartCount]           = useState(() => loadCart().length);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async (rec: AssemedReceituario) => {
    setParserRec(rec);
    setParserStep("loading");
    setParserOpen(true);
    setMatchedMeds([]);
    setManualText("");
    setParserLoading(true);

    // 1. Tenta extrair via URL
    const text = await extractTextFromUrl(rec.urlPdf);
    if (text && text.trim().length > 20) {
      const matches = await matchMedicationsInText(text);
      setMatchedMeds(matches);
      setParserStep("results");
    } else {
      // CORS bloqueou ou PDF vazio → modo manual
      setParserStep("manual");
    }
    setParserLoading(false);
  };

  const handleManualAnalyze = async () => {
    if (!manualText.trim()) return;
    setParserLoading(true);
    const matches = await matchMedicationsInText(manualText);
    setMatchedMeds(matches);
    setParserStep("results");
    setParserLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParserLoading(true);
    const text = await extractTextFromFile(file);
    if (text && text.trim().length > 20) {
      const matches = await matchMedicationsInText(text);
      setMatchedMeds(matches);
      setParserStep("results");
    } else {
      toast({ title: "Não foi possível extrair texto do PDF", description: "Cole o texto manualmente abaixo.", variant: "destructive" });
    }
    setParserLoading(false);
  };

  const addToCart = (med: MedicationCatalog) => {
    const cart = loadCart();
    const existing = cart.find(i => i.cartItemId === med.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ cartItemId: med.id, name: med.name, dosage: med.dosage || "", price: med.price, quantity: 1 });
    }
    saveCart(cart);
    setAddedIds(prev => new Set([...prev, med.id]));
    setCartCount(cart.length);
    toast({ title: `${med.name} adicionado ao carrinho` });
    setTimeout(() => {
      setAddedIds(prev => { const s = new Set(prev); s.delete(med.id); return s; });
    }, 1500);
  };

  // Carrega receituários de todas as consultas Assemed (em paralelo)
  useEffect(() => {
    // Aguarda o hook terminar de autenticar antes de tomar decisão
    if (assemedLoading) {
      console.log("[Prescriptions] Aguardando autenticação Assemed...");
      return;
    }

    let cancelled = false;

    const loadReceituarios = async () => {
      setLoadingReceituarios(true);
      setReceituariosError(null);
      try {
        // Só prossegue se o hook retornou um token validado para o usuário atual
        if (!assemedAccessToken) {
          console.log("[Prescriptions] Sem token Assemed — paciente pode não estar cadastrado no Assemed");
          setLoadingReceituarios(false);
          return;
        }

        const { assemedClient } = await import("@/integrations/assemed/client");
        assemedClient.setAccessToken(assemedAccessToken);

        // 1. Buscar todas as consultas via /obter
        console.log("[Prescriptions] Buscando consultas...");
        const response = await assemedClient.getConsultations(50, 0);
        const consultations = response.items || [];

        console.log("[Prescriptions] Consultas carregadas:", consultations.length,
          consultations.map(c => ({
            id: c.id,
            status: normalizeConsultationStatus(c),
          }))
        );

        if (cancelled) return;

        // 2. Buscar receituários em paralelo (pula canceladas)
        const eligibleConsultations = consultations.filter(
          c => normalizeConsultationStatus(c) !== "CANCELADO"
        );

        const results = await Promise.allSettled(
          eligibleConsultations.map(async (consultation) => {
            const items = await assemedClient.getReceituarios(consultation.id);
            return { consultation, items };
          })
        );

        if (cancelled) return;

        const receituarios: AssemedReceituario[] = [];
        let hasServerError = false;   // 500+
        let hasAuthError = false;     // 401/403
        let hasNetworkError = false;  // timeout / fetch failure

        for (const result of results) {
          if (result.status === "rejected") {
            const err = result.reason;
            if (err instanceof AssemedApiError) {
              if (err.statusCode >= 500) {
                hasServerError = true;
              } else if (err.statusCode === 401 || err.statusCode === 403) {
                hasAuthError = true;
              }
              // 404 e outros 4xx: silencioso (consulta sem receituário)
            } else {
              // Erro de rede / timeout (TypeError do fetch)
              hasNetworkError = true;
            }
            continue;
          }
          const { consultation, items } = result.value;
          if (items && items.length > 0) {
            console.log(`[Prescriptions] Consulta #${consultation.id}: ${items.length} receituário(s)`);
          }
          for (const item of items) {
            if (item.urlPdf) {
              receituarios.push({
                consultationId: consultation.id,
                especialidade: consultation.especialidadeNome || "Consulta",
                profissional: consultation.profissionalNome || null,
                data: consultation.dataHoraFim || consultation.dataHoraCriacao || consultation.dataCriacao,
                status: normalizeConsultationStatus(consultation),
                urlPdf: item.urlPdf,
              });
            }
          }
        }

        if (cancelled) return;

        // Classifica o erro mais relevante para exibir ao usuário
        if (hasServerError) {
          setReceituariosError("Não foi possível carregar os receituários. Tente novamente mais tarde.");
        } else if (hasAuthError && receituarios.length === 0) {
          setReceituariosError("Sessão expirada. Recarregue a página para tentar novamente.");
        } else if (hasNetworkError && receituarios.length === 0) {
          setReceituariosError("Erro de conexão. Verifique sua internet e tente novamente.");
        }
        // 404 ou lista vazia: sem mensagem de erro

        console.log("[Prescriptions] Total de receituários encontrados:", receituarios.length);
        setAssemedReceituarios(receituarios);
      } catch (err) {
        console.error("[Prescriptions] Erro ao carregar receituários Assemed:", err);
        // Erro ao buscar a lista de consultas (antes das chamadas de receituário)
        if (err instanceof AssemedApiError) {
          if (err.statusCode >= 500) {
            setReceituariosError("Não foi possível carregar os receituários. Tente novamente mais tarde.");
          } else if (err.statusCode === 401 || err.statusCode === 403) {
            setReceituariosError("Sessão expirada. Recarregue a página para tentar novamente.");
          }
          // 404 e outros 4xx: silencioso
        } else {
          // Erro de rede / timeout
          setReceituariosError("Erro de conexão. Verifique sua internet e tente novamente.");
        }
      } finally {
        setLoadingReceituarios(false);
      }
    };

    loadReceituarios();

    return () => { cancelled = true; };
  }, [assemedAccessToken, assemedLoading]);

  // Filtra receituários pelo termo de busca
  const filteredReceituarios = useMemo(() => {
    if (!searchTerm.trim()) return assemedReceituarios;
    const term = searchTerm.toLowerCase();
    return assemedReceituarios.filter(rec =>
      rec.consultationId.toString().includes(term) ||
      rec.especialidade.toLowerCase().includes(term) ||
      (rec.profissional && rec.profissional.toLowerCase().includes(term))
    );
  }, [assemedReceituarios, searchTerm]);

  useEffect(() => {
    if (receituariosError) {
      toast({
        title: "Erro",
        description: receituariosError,
        variant: "destructive",
      });
    }
  }, [receituariosError, toast]);

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated />

      <main className="page-container">
        <PageHeader
          title="Meus Receituários"
          subtitle="Visualize e baixe os receituários das suas teleconsultas"
          icon={Stethoscope}
        />

        {/* Search Bar */}
        {assemedReceituarios.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                type="text"
                placeholder="Buscar por especialidade, profissional ou número da consulta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}

        {/* Stats Card */}
        {!loadingReceituarios && assemedReceituarios.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de Receituários
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{assemedReceituarios.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Consultas com Receituário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {new Set(assemedReceituarios.map(r => r.consultationId)).size}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Receituários List */}
        {loadingReceituarios ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Buscando receituários das consultas...</p>
            </CardContent>
          </Card>
        ) : receituariosError && assemedReceituarios.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-destructive mb-4" />
              <p className="text-sm text-destructive">{receituariosError}</p>
            </CardContent>
          </Card>
        ) : filteredReceituarios.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? "Nenhum receituário encontrado para a busca"
                  : "Nenhum receituário disponível"}
              </p>
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4"
                  onClick={() => setSearchTerm("")}
                >
                  Limpar busca
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredReceituarios.map((rec, index) => (
              <Card key={`assemed-rec-${rec.consultationId}-${index}`} className="bg-card border-border/50 hover:shadow-card transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <CardTitle className="text-base">
                        Consulta #{rec.consultationId}
                      </CardTitle>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200 shrink-0">
                      {rec.status === "CONCLUIDO" ? "Concluída" : rec.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Especialidade</p>
                      <p className="font-medium">{rec.especialidade}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Profissional</p>
                      <p className="font-medium">{rec.profissional || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs">Data</p>
                      <p className="font-medium">
                        {(() => {
                          try {
                            return format(new Date(rec.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                          } catch {
                            return rec.data;
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => window.open(rec.urlPdf, "_blank")}
                    >
                      <Download className="h-4 w-4" />
                      Baixar Receituário
                      <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                    </Button>
                    <Button
                      size="sm"
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleAnalyze(rec)}
                    >
                      <Pill className="h-4 w-4" />
                      Analisar Medicamentos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <ActiveConsultationBanner accessToken={assemedAccessToken} />

      {/* ── Floating cart bar ─────────────────────────────────────────── */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => window.location.href = "/cart"}
            className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-full shadow-xl transition-all"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="font-semibold">{cartCount} item{cartCount > 1 ? "s" : ""} no carrinho</span>
          </button>
        </div>
      )}

      {/* ── Modal de Análise de Medicamentos ──────────────────────────── */}
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

          {/* Loading */}
          {parserLoading && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
              <p className="text-sm text-muted-foreground">Analisando receituário...</p>
            </div>
          )}

          {/* Modo manual (CORS bloqueou) */}
          {!parserLoading && parserStep === "manual" && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Não foi possível ler o PDF automaticamente.</p>
                  <p className="text-xs mt-1">Cole o texto do receituário abaixo ou faça upload do arquivo PDF.</p>
                </div>
              </div>

              {/* Upload PDF */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Fazer upload do PDF
                </Button>
              </div>

              <Separator />

              {/* Texto manual */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Ou cole o texto do receituário:</label>
                <Textarea
                  placeholder="Ex: Dipirona 500mg — tomar 1x ao dia por 5 dias&#10;Amoxicilina 500mg — 1 cápsula a cada 8h..."
                  rows={6}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                />
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                  disabled={!manualText.trim() || parserLoading}
                  onClick={handleManualAnalyze}
                >
                  {parserLoading
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Analisando...</>
                    : <><Search className="h-4 w-4" />Identificar Medicamentos</>}
                </Button>
              </div>
            </div>
          )}

          {/* Resultados */}
          {!parserLoading && parserStep === "results" && (
            <div className="space-y-4">
              {matchedMeds.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <p className="text-muted-foreground">Nenhum medicamento do nosso catálogo foi encontrado nesta receita.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setParserStep("manual")}
                  >
                    Tentar manualmente
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      <strong>{matchedMeds.length}</strong> medicamento{matchedMeds.length > 1 ? "s" : ""} encontrado{matchedMeds.length > 1 ? "s" : ""} na receita e disponível{matchedMeds.length > 1 ? "is" : ""} na farmácia.
                    </span>
                  </div>

                  <div className="space-y-2">
                    {matchedMeds.map(({ medication: med, confidence }) => (
                      <div
                        key={med.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{med.name}</p>
                            {confidence === "high" && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-4 gap-0.5">
                                <Star className="h-2.5 w-2.5" />
                                Prescrito
                              </Badge>
                            )}
                          </div>
                          {med.active_ingredient && (
                            <p className="text-xs text-muted-foreground">{med.active_ingredient}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {med.dosage && <span className="text-xs text-muted-foreground">{med.dosage}</span>}
                            {med.pharmacy_name && (
                              <span className="text-xs text-primary/70">· {med.pharmacy_name}</span>
                            )}
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
                            className={`gap-1.5 text-xs transition-all ${
                              addedIds.has(med.id)
                                ? "bg-emerald-600 text-white"
                                : "bg-primary hover:bg-primary/90"
                            }`}
                            onClick={() => addToCart(med)}
                          >
                            {addedIds.has(med.id) ? (
                              <><CheckCircle2 className="h-3.5 w-3.5" />Adicionado</>
                            ) : (
                              <><ShoppingCart className="h-3.5 w-3.5" />Adicionar</>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {cartCount > 0 && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => window.location.href = "/cart"}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Ver carrinho ({cartCount} {cartCount === 1 ? "item" : "itens"})
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setParserStep("manual")}
                  >
                    Não encontrou o que procura? Buscar manualmente
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

export default Prescriptions;
