import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search, FileText, Loader2,
  Stethoscope, ShoppingCart, CheckCircle2, Calendar, User, Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizeConsultationStatus } from "@/integrations/assemed/types";
import { AssemedApiError } from "@/integrations/assemed/client";
import { PrescriptionMedicationsModal } from "@/components/prescription/PrescriptionMedicationsModal";
import { usePaidPrescriptions } from "@/hooks/usePaidPrescriptions";
import { extractTextFromUrl } from "@/services/prescriptionParserService";
import { supabase } from "@/integrations/supabase/client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type DocKind = "receita" | "exame";

interface AssemedReceituario {
  consultationId: number;
  docIndex: number;
  kind: DocKind;
  especialidade: string;
  profissional: string | null;
  data: string;
  status: string;
  urlPdf: string;
}

// ─── Cart helpers ─────────────────────────────────────────────────────────────

function loadCart(): unknown[] {
  try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
}

// ─── Página ───────────────────────────────────────────────────────────────────

const Prescriptions = () => {
  const { toast } = useToast();
  const { accessToken: assemedAccessToken, isLoading: assemedLoading } = useAssemedToken();
  const [searchTerm, setSearchTerm] = useState("");

  const [assemedReceituarios, setAssemedReceituarios] = useState<AssemedReceituario[]>([]);
  const [loadingReceituarios, setLoadingReceituarios] = useState(true);
  const [receituariosError, setReceituariosError] = useState<string | null>(null);

  // Carrinho
  const [cartCount, setCartCount] = useState(() => loadCart().length);
  const { isPaid, markAsUnpaid } = usePaidPrescriptions();

  // Modal de medicamentos
  const [medicModalOpen, setMedicModalOpen] = useState(false);
  const [selectedRec, setSelectedRec] = useState<AssemedReceituario | null>(null);

  // ── Abre modal de análise de medicamentos ──────────────────────────────────

  function openMedicModal(rec: AssemedReceituario) {
    setSelectedRec(rec);
    setMedicModalOpen(true);
  }

  // ── Carrega receituários Assemed ───────────────────────────────────────────

  useEffect(() => {
    if (assemedLoading) return;

    let cancelled = false;

    const loadReceituarios = async () => {
      setLoadingReceituarios(true);
      setReceituariosError(null);
      try {
        if (!assemedAccessToken) {
          setLoadingReceituarios(false);
          return;
        }

        const { assemedClient } = await import("@/integrations/assemed/client");
        assemedClient.setAccessToken(assemedAccessToken);

        const response = await assemedClient.getConsultations(50, 0);
        const consultations = response.items || [];

        if (cancelled) return;

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
        let hasServerError = false;
        let hasAuthError = false;
        let hasNetworkError = false;

        for (const result of results) {
          if (result.status === "rejected") {
            const err = result.reason;
            if (err instanceof AssemedApiError) {
              if (err.statusCode >= 500) hasServerError = true;
              else if (err.statusCode === 401 || err.statusCode === 403) hasAuthError = true;
            } else {
              hasNetworkError = true;
            }
            continue;
          }
          const { consultation, items } = result.value;
          const validItems = items.filter(i => i.urlPdf);
          if (validItems.length === 0) continue;

          // Classifica cada PDF — pedido de exame vs receita
          const classified = await Promise.all(
            validItems.map(async (item) => {
              try {
                const text = await extractTextFromUrl(item.urlPdf);
                const kind: DocKind = !!text && /\bexames?\b/i.test(text) ? "exame" : "receita";
                return { urlPdf: item.urlPdf, kind };
              } catch {
                return { urlPdf: item.urlPdf, kind: "receita" as DocKind };
              }
            })
          );

          // Um card por documento
          classified.forEach((doc, docIndex) => {
            receituarios.push({
              consultationId: consultation.id,
              docIndex,
              kind: doc.kind,
              especialidade: consultation.especialidadeNome || "Consulta",
              profissional: consultation.profissionalNome || null,
              data: consultation.dataHoraFim || consultation.dataHoraCriacao || consultation.dataCriacao,
              status: normalizeConsultationStatus(consultation),
              urlPdf: doc.urlPdf,
            });
          });
        }

        if (cancelled) return;

        if (hasServerError) {
          setReceituariosError("Não foi possível carregar os receituários. Tente novamente mais tarde.");
        } else if (hasAuthError && receituarios.length === 0) {
          setReceituariosError("Sessão expirada. Recarregue a página para tentar novamente.");
        } else if (hasNetworkError && receituarios.length === 0) {
          setReceituariosError("Erro de conexão. Verifique sua internet e tente novamente.");
        }

        setAssemedReceituarios(receituarios);
      } catch (err) {
        if (err instanceof AssemedApiError) {
          if (err.statusCode >= 500) {
            setReceituariosError("Não foi possível carregar os receituários. Tente novamente mais tarde.");
          } else if (err.statusCode === 401 || err.statusCode === 403) {
            setReceituariosError("Sessão expirada. Recarregue a página para tentar novamente.");
          }
        } else {
          setReceituariosError("Erro de conexão. Verifique sua internet e tente novamente.");
        }
      } finally {
        setLoadingReceituarios(false);
      }
    };

    loadReceituarios();
    return () => { cancelled = true; };
  }, [assemedAccessToken, assemedLoading]);

  useEffect(() => {
    if (receituariosError) {
      toast({ title: "Erro", description: receituariosError, variant: "destructive" });
    }
  }, [receituariosError, toast]);

  // Verifica pedidos rejeitados e libera o botão "Adquirir medicamentos"
  useEffect(() => {
    if (assemedReceituarios.length === 0) return;

    const checkRejectedOrders = async () => {
      const consultationIds = assemedReceituarios.map(r => String(r.consultationId));
      const { data } = await supabase
        .from("orders")
        .select("receita_id, receita_review_status, status")
        .in("receita_id", consultationIds)
        .eq("receita_review_status", "rejected");

      if (data && data.length > 0) {
        const rejectedIds = data.map(o => String(o.receita_id));
        markAsUnpaid(rejectedIds);
      }
    };

    checkRejectedOrders();
  }, [assemedReceituarios, markAsUnpaid]);

  const filteredReceituarios = useMemo(() => {
    if (!searchTerm.trim()) return assemedReceituarios;
    const term = searchTerm.toLowerCase();
    return assemedReceituarios.filter(rec =>
      rec.consultationId.toString().includes(term) ||
      rec.especialidade.toLowerCase().includes(term) ||
      (rec.profissional && rec.profissional.toLowerCase().includes(term))
    );
  }, [assemedReceituarios, searchTerm]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated />

      <main className="page-container">
        <PageHeader
          title="Meus Receituários"
          subtitle="Visualize, analise com IA e compre os medicamentos das suas teleconsultas"
          icon={Stethoscope}
        />

        {/* Busca */}
        {assemedReceituarios.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                type="text"
                placeholder="Buscar por especialidade, profissional ou número da consulta..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}

        {/* Stats */}
        {!loadingReceituarios && assemedReceituarios.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Receituários</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{assemedReceituarios.filter(r => r.kind === "receita").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Consultas com Receituário</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {new Set(assemedReceituarios.map(r => r.consultationId)).size}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista */}
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
                {searchTerm ? "Nenhum receituário encontrado para a busca" : "Nenhum receituário disponível"}
              </p>
              {searchTerm && (
                <Button variant="ghost" size="sm" className="mt-4" onClick={() => setSearchTerm("")}>
                  Limpar busca
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredReceituarios.map((rec) => {
              const isExame = rec.kind === "exame";
              const pago = !isExame && isPaid(rec.consultationId);
              const dataFormatada = (() => {
                try { return format(new Date(rec.data), "dd/MM/yyyy", { locale: ptBR }); } catch { return rec.data; }
              })();
              const horaFormatada = (() => {
                try { return format(new Date(rec.data), "HH:mm", { locale: ptBR }); } catch { return ""; }
              })();
              return (
              <Card
                key={`assemed-rec-${rec.consultationId}-${rec.docIndex}`}
                className={`flex flex-col overflow-hidden border transition-all duration-200 hover:shadow-md ${
                  isExame
                    ? "border-violet-200 bg-violet-50/30 hover:border-violet-300"
                    : pago
                      ? "border-blue-200 bg-blue-50/30 hover:border-blue-300"
                      : "border-border/60 bg-card hover:border-primary/30"
                }`}
              >
                <div className={`h-1 w-full ${isExame ? "bg-violet-400" : pago ? "bg-blue-400" : "bg-emerald-500"}`} />

                <div className="p-5 flex flex-col flex-1 gap-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isExame ? "bg-violet-100" : pago ? "bg-blue-100" : "bg-primary/10"
                      }`}>
                        <FileText className={`h-5 w-5 ${isExame ? "text-violet-600" : pago ? "text-blue-600" : "text-primary"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground leading-tight">
                          {isExame ? "Pedido de Exame" : "Receituário"}
                        </p>
                        <p className="text-xs text-muted-foreground">Consulta #{rec.consultationId}</p>
                      </div>
                    </div>
                    {isExame ? (
                      <Badge className="shrink-0 text-[11px] font-medium px-2 py-0.5 bg-violet-100 text-violet-700 border-violet-200">
                        Exame
                      </Badge>
                    ) : (
                      <Badge className={`shrink-0 text-[11px] font-medium px-2 py-0.5 ${
                        pago
                          ? "bg-blue-100 text-blue-700 border-blue-200"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200"
                      }`}>
                        {pago ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" />Adquirido</>
                        ) : (
                          <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />Disponível</>
                        )}
                      </Badge>
                    )}
                  </div>

                  {/* Info grid */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Stethoscope className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-foreground font-medium truncate">{rec.especialidade}</span>
                    </div>
                    {rec.profissional && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground truncate">{rec.profissional}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>{dataFormatada}{horaFormatada && <span className="ml-1 text-muted-foreground/70">· {horaFormatada}</span>}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto pt-1 flex flex-col gap-2">
                    {isExame ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 h-9 text-sm font-medium border-violet-200 text-violet-700 hover:bg-violet-50"
                        asChild
                      >
                        <a href={rec.urlPdf} target="_blank" rel="noopener noreferrer" download>
                          <Download className="h-4 w-4" />
                          Baixar Pedido de Exame
                        </a>
                      </Button>
                    ) : (
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
                        {pago ? (
                          <><CheckCircle2 className="h-4 w-4" />Medicamentos adquiridos</>
                        ) : (
                          <><ShoppingCart className="h-4 w-4" />Adquirir medicamentos</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </main>

      <ActiveConsultationBanner accessToken={assemedAccessToken} />

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => { window.location.href = "/cart"; }}
            className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-full shadow-xl transition-all"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="font-semibold">
              {cartCount} item{cartCount > 1 ? "s" : ""} no carrinho
            </span>
          </button>
        </div>
      )}

      {/* Modal de medicamentos com IA */}
      <PrescriptionMedicationsModal
        open={medicModalOpen}
        onOpenChange={setMedicModalOpen}
        prescriptionPdfUrl={selectedRec?.urlPdf}
        prescriptionTitle={selectedRec ? `Consulta #${selectedRec.consultationId}` : undefined}
        consultationId={selectedRec?.consultationId}
        onCartUpdated={count => setCartCount(count)}
      />
    </div>
  );
};

export default Prescriptions;
