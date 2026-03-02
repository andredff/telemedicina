import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Video, X, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Consultation } from "@/integrations/assemed/types";
import { normalizeConsultationStatus } from "@/integrations/assemed/types";

interface ActiveConsultationBannerProps {
  accessToken: string | null;
}

export function ActiveConsultationBanner({ accessToken }: ActiveConsultationBannerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const hasLoaded = useRef(false);

  const loadActiveConsultation = useCallback(async () => {
    if (!accessToken || isDismissed) return;

    try {
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setAccessToken(accessToken);
      
      const response = await assemedClient.getConsultations(10, 0);
      const consultations = response.items || [];
      
      console.log("[ActiveConsultationBanner] Consultas carregadas:", consultations.length, consultations.map(c => ({
        id: c.id,
        status: c.status,
        situacao: c.situacao,
        desc: c.situacaoAtendimentoDescricao,
        normalized: normalizeConsultationStatus(c)
      })));

      // Encontra a primeira consulta ativa usando normalizeConsultationStatus
      const active = consultations.find((c) => {
        const normalized = normalizeConsultationStatus(c);
        return normalized === "AGUARDANDO" || normalized === "EM_ATENDIMENTO";
      });
      
      console.log("[ActiveConsultationBanner] Consulta ativa encontrada:", active?.id ?? "nenhuma");
      setActiveConsultation(active || null);
      hasLoaded.current = true;
    } catch (err) {
      console.error("[ActiveConsultationBanner] Erro ao buscar consultas:", err);
      setActiveConsultation(null);
    }
  }, [accessToken, isDismissed]);

  useEffect(() => {
    loadActiveConsultation();
    
    // Recarrega a cada 15 segundos
    const interval = setInterval(loadActiveConsultation, 15000);
    
    return () => clearInterval(interval);
  }, [loadActiveConsultation]);

  const handleEnter = () => {
    if (activeConsultation) {
      navigate(
        `/sala-espera/${activeConsultation.id}?especialidade=${encodeURIComponent(
          activeConsultation.especialidadeNome || "Consulta"
        )}`
      );
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
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

              <Button
                onClick={handleEnter}
                size="sm"
                className="w-full gap-2"
              >
                {isWaiting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrar na Sala
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    Entrar na Consulta
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
