import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Loader2, Download, ExternalLink, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizeConsultationStatus } from "@/integrations/assemed/types";
import { AssemedApiError } from "@/integrations/assemed/client";

// Receituário vindo da API Assemed
interface AssemedReceituario {
  consultationId: number;
  especialidade: string;
  profissional: string | null;
  data: string;
  status: string;
  urlPdf: string;
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
      <Header isAuthenticated title="Receituários" />

      <main className="container mx-auto px-4 py-8">
        <BackLink />
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            Meus Receituários
          </h1>
          <p className="text-muted-foreground">
            Visualize e baixe os receituários das suas teleconsultas
          </p>
        </div>

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
                  <div className="pt-2 border-t border-border/50">
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <ActiveConsultationBanner accessToken={assemedAccessToken} />
    </div>
  );
};

export default Prescriptions;
