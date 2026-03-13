import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Video, X, Clock, Loader2, Ban, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Consultation, ConsultationSimplified } from "@/integrations/assemed/types";
import { normalizeConsultationStatus, normalizeSimplifiedStatus } from "@/integrations/assemed/types";

const STORAGE_KEY = "novita_active_consultation";
const POLL_INTERVAL = 10000; // 10 segundos

interface CachedConsultation {
  id: number;
  especialidadeNome: string;
  profissionalNome: string | null;
  situacao: string;
}

function getCachedConsultation(): CachedConsultation | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function setCachedConsultation(consultation: CachedConsultation | null) {
  try {
    if (consultation) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consultation));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

interface ActiveConsultationBannerProps {
  accessToken: string | null;
}

export function ActiveConsultationBanner({ accessToken }: ActiveConsultationBannerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const hasLoaded = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Verifica status da consulta usando endpoint simplificado
   * GET /api/Atendimentos/{id}/simplificado
   */
  const checkConsultationStatus = useCallback(async (consultationId: number): Promise<ConsultationSimplified | null> => {
    try {
      if (!accessToken) return null;
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setAccessToken(accessToken);
      const response = await assemedClient.getConsultationStatus(consultationId);
      // Normaliza o status (API pode retornar em diferentes formatos)
      const normalizedStatus = normalizeSimplifiedStatus(response);
      console.log(`[ActiveConsultationBanner] Status simplificado consulta ${consultationId}:`, response.situacao, '-> normalizado:', normalizedStatus);
      return { ...response, situacao: normalizedStatus };
    } catch (err) {
      console.error("[ActiveConsultationBanner] Erro ao verificar status simplificado:", err);
      return null;
    }
  }, [accessToken]);

  /**
   * Carrega consulta ativa usando cache + endpoint simplificado
   * Se não houver cache, busca lista completa de consultas
   */
  const loadActiveConsultation = useCallback(async () => {
    try {
      if (!accessToken) return;
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setAccessToken(accessToken);
      
      // Primeiro tenta usar cache e verificar com endpoint simplificado
      const cached = getCachedConsultation();
      if (cached) {
        console.log("[ActiveConsultationBanner] Verificando consulta em cache:", cached.id);
        const status = await checkConsultationStatus(cached.id);
        
        if (status && (status.situacao === "AGUARDANDO" || status.situacao === "EM_ATENDIMENTO")) {
          // Atualiza consulta em cache com status atualizado
          const updatedCached = { ...cached, situacao: status.situacao, profissionalNome: status.profissionalNome };
          setCachedConsultation(updatedCached);
          setActiveConsultation({
            id: cached.id,
            pacienteId: 0,
            pacienteNome: "",
            especialidadeId: 0,
            especialidadeNome: cached.especialidadeNome,
            tipoProfissionalId: 0,
            profissionalNome: status.profissionalNome,
            status: status.situacao,
            dataHoraCriacao: "",
            dataHoraInicio: null,
            dataHoraFim: null,
            pacienteToken: null,
          });
          hasLoaded.current = true;
          return;
        } else {
          // Consulta em cache não está mais ativa
          console.log("[ActiveConsultationBanner] Consulta em cache não está mais ativa");
          setCachedConsultation(null);
        }
      }

      // Fallback: busca lista completa de consultas
      console.log("[ActiveConsultationBanner] Buscando lista completa de consultas");
      const response = await assemedClient.getConsultations(10, 0);
      const consultations = response.items || [];
      
      console.log("[ActiveConsultationBanner] Consultas carregadas:", consultations.length);

      // Encontra a primeira consulta ativa usando normalizeConsultationStatus
      const active = consultations.find((c) => {
        const normalized = normalizeConsultationStatus(c);
        return normalized === "AGUARDANDO" || normalized === "EM_ATENDIMENTO";
      });
      
      console.log("[ActiveConsultationBanner] Consulta ativa encontrada:", active?.id ?? "nenhuma");
      
      if (active) {
        // Salva em cache para próximas verificações
        setCachedConsultation({
          id: active.id,
          especialidadeNome: active.especialidadeNome,
          profissionalNome: active.profissionalNome,
          situacao: normalizeConsultationStatus(active),
        });
      } else {
        setCachedConsultation(null);
      }
      
      setActiveConsultation(active || null);
      hasLoaded.current = true;
    } catch (err) {
      console.error("[ActiveConsultationBanner] Erro ao buscar consultas:", err);
      setActiveConsultation(null);
    }
  }, [accessToken, checkConsultationStatus]);

  // Rastreia consultas para as quais já redirecionamos (evita loop)
  const redirectedIds = useRef<Set<number>>(new Set());

  /**
   * Polling periódico usando endpoint simplificado
   */
  useEffect(() => {
    if (!accessToken || isDismissed || !activeConsultation) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const pollStatus = async () => {
      const status = await checkConsultationStatus(activeConsultation.id);

      if (!status) return;

      if (status.situacao === "CONCLUIDO" || status.situacao === "CANCELADO") {
        // Consulta finalizada - limpa cache e estado
        console.log("[ActiveConsultationBanner] Consulta finalizada:", status.situacao);
        setCachedConsultation(null);
        setActiveConsultation(null);
        return;
      }

      // Redireciona automaticamente quando médico inicia atendimento
      if (status.situacao === "EM_ATENDIMENTO" && !redirectedIds.current.has(activeConsultation.id)) {
        const alreadyInRoom = location.pathname.startsWith("/sala-espera");
        if (!alreadyInRoom) {
          redirectedIds.current.add(activeConsultation.id);
          console.log("[ActiveConsultationBanner] Médico iniciou atendimento, redirecionando...");
          navigate(
            `/sala-espera/${activeConsultation.id}?especialidade=${encodeURIComponent(
              activeConsultation.especialidadeNome || "Consulta"
            )}`
          );
          return;
        }
      }

      // Atualiza dados do profissional se mudou
      if (status.profissionalNome !== activeConsultation.profissionalNome ||
          status.situacao !== activeConsultation.status) {
        setActiveConsultation(prev => prev ? {
          ...prev,
          profissionalNome: status.profissionalNome,
          status: status.situacao,
        } : null);

        const cached = getCachedConsultation();
        if (cached) {
          setCachedConsultation({
            ...cached,
            profissionalNome: status.profissionalNome,
            situacao: status.situacao,
          });
        }
      }
    };

    // Verifica imediatamente e depois a cada intervalo
    pollStatus();
    pollingRef.current = setInterval(pollStatus, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [accessToken, isDismissed, activeConsultation, checkConsultationStatus, navigate, location.pathname]);

  useEffect(() => {
    if (!isDismissed) {
      loadActiveConsultation();
    }
  }, [loadActiveConsultation, isDismissed]);

  const handleEnter = () => {
    if (activeConsultation) {
      navigate(
        `/sala-espera/${activeConsultation.id}?especialidade=${encodeURIComponent(
          activeConsultation.especialidadeNome || "Consulta"
        )}`
      );
    }
  };

  const handleOpenNewTab = async () => {
    if (!activeConsultation || !accessToken) return;
    try {
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setAccessToken(accessToken);
      const fresh = await assemedClient.getConsultation(activeConsultation.id);
      if (!fresh?.pacienteToken) {
        toast({ title: "Consulta indisponível", description: "Token do paciente não disponível.", variant: "destructive" });
        return;
      }
      const isSandbox = import.meta.env.VITE_ASSEMED_SANDBOX === "true" || import.meta.env.DEV;
      const base = isSandbox ? "https://dev-app-assemed.azurewebsites.net" : "https://app.assemedtelemedicina.com";
      window.open(`${base}/sala-espera-externa/${activeConsultation.id}?token=${encodeURIComponent(fresh.pacienteToken)}`, "_blank");
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível abrir a consulta.", variant: "destructive" });
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const handleCancel = async () => {
    if (!activeConsultation || !accessToken) return;
    
    setIsCancelling(true);
    try {
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setAccessToken(accessToken);
      await assemedClient.cancelConsultation(activeConsultation.id);
      
      // Limpa cache e estado
      setCachedConsultation(null);
      setActiveConsultation(null);
      
      toast({
        title: "Consulta cancelada",
        description: "Sua consulta foi cancelada com sucesso.",
      });
    } catch (err) {
      console.error("[ActiveConsultationBanner] Erro ao cancelar consulta:", err);
      toast({
        title: "Erro ao cancelar",
        description: "Não foi possível cancelar a consulta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Não mostra na própria sala de espera
  if (location.pathname.startsWith("/sala-espera")) {
    return null;
  }

  // Não mostra se não há consulta ativa ou foi fechado
  if (!activeConsultation || isDismissed) {
    return null;
  }

  const normalizedStatus = normalizeConsultationStatus(activeConsultation);
  const isWaiting = normalizedStatus === "AGUARDANDO";

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
      <Card className="w-80 border-2 border-primary/50 shadow-2xl bg-card">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
              {isWaiting ? (
                <Clock className="h-5 w-5 text-primary animate-pulse" />
              ) : (
                <Video className="h-5 w-5 text-primary" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {isWaiting ? "Aguardando Atendimento" : "Consulta em Andamento"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeConsultation.especialidadeNome}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 -mt-1 -mr-2"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {activeConsultation.profissionalNome && (
                <p className="text-xs text-muted-foreground mb-2">
                  {activeConsultation.profissionalNome}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleEnter}
                  size="sm"
                  className="flex-1 gap-2"
                >
                  {isWaiting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Entrar
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4" />
                      Entrar
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleOpenNewTab}
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  title="Abrir em nova aba"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleCancel}
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="h-4 w-4" />
                  )}
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
