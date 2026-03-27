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
  Search, FileText, Loader2, Download, ExternalLink,
  Stethoscope, ShoppingCart, Pill,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizeConsultationStatus } from "@/integrations/assemed/types";
import { AssemedApiError } from "@/integrations/assemed/client";
import { PrescriptionMedicationsModal } from "@/components/prescription/PrescriptionMedicationsModal";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AssemedReceituario {
  consultationId: number;
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
                <div className="text-2xl font-bold">{assemedReceituarios.length}</div>
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
            {filteredReceituarios.map((rec, index) => (
              <Card
                key={`assemed-rec-${rec.consultationId}-${index}`}
                className="bg-card border-border/50 hover:shadow-card transition-all"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <CardTitle className="text-base">Consulta #{rec.consultationId}</CardTitle>
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
                    {/* <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => window.open(rec.urlPdf, "_blank")}
                    >
                      <Download className="h-4 w-4" />
                      Baixar Receituário
                      <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                    </Button> */}
                    <Button
                      size="sm"
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => openMedicModal(rec)}
                    >
                      <Pill className="h-4 w-4" />
                      Adquirir medicamentos da receita
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
