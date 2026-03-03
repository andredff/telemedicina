import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Loader2, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { ConsultationStatus } from "@/integrations/assemed/types";
import { normalizeSimplifiedStatus } from "@/integrations/assemed/types";

function getIsSandbox() {
  return import.meta.env.VITE_ASSEMED_SANDBOX === "true" || import.meta.env.DEV;
}

// Mapeia status da API para texto amigável
const statusLabels: Record<ConsultationStatus, string> = {
  AGUARDANDO: "Aguardando atendimento",
  EM_ATENDIMENTO: "Em atendimento",
  CONCLUIDO: "Consulta concluída",
  CANCELADO: "Consulta cancelada",
};

export default function SalaEspera() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEnter, setShowEnter] = useState(false);
  const [consultationStatus, setConsultationStatus] = useState<ConsultationStatus>("AGUARDANDO");
  const [profissionalNome, setProfissionalNome] = useState<string | null>(null);

  const q = new URLSearchParams(location.search);
  const especialidade = q.get("especialidade") || "Clínico Geral";
  const atendimentoId = Number(id || q.get("sala") || 0);

  useEffect(() => {
    // if token provided in query, show enter button
    const token = q.get("token");
    if (token) setShowEnter(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling para verificar status do atendimento usando endpoint simplificado
  useEffect(() => {
    if (!atendimentoId) return;

    const checkConsultationStatus = async () => {
      try {
        const { assemedClient } = await import("@/integrations/assemed/client");
        const response = await assemedClient.getConsultationStatus(atendimentoId);
        
        // Normaliza o status (API pode retornar em diferentes formatos)
        const normalizedStatus = normalizeSimplifiedStatus(response);
        
        console.log(`[SalaEspera] Status consulta ${atendimentoId}:`, response.situacao, '-> normalizado:', normalizedStatus, 'profissional:', response.profissionalNome);
        
        // Atualiza status e profissional
        setConsultationStatus(normalizedStatus);
        setProfissionalNome(response.profissionalNome);
        
        if (normalizedStatus === "CONCLUIDO") {
          // Fecha o iframe e mostra mensagem
          setIframeSrc(null);
          setShowEnter(false);
          toast({
            title: "Consulta Finalizada",
            description: "Sua teleconsulta foi concluída. Obrigado por usar nossos serviços!",
          });
          // Navega de volta para teleconsultas após 3 segundos
          setTimeout(() => {
            navigate('/teleconsultas');
          }, 3000);
        } else if (normalizedStatus === "CANCELADO") {
          setIframeSrc(null);
          setShowEnter(false);
          
          // Restaura o crédito do usuário para qualquer cancelamento
          try {
            const { error } = await (supabase as any)
              .from("consultation_credits")
              .update({
                status: "available",
                consultation_id: null,
                used_at: null,
              })
              .eq("consultation_id", atendimentoId)
              .eq("status", "used");
            
            if (!error) {
              logger.info(`Crédito restaurado para consulta cancelada ${atendimentoId}`);
              toast({
                title: "Consulta Cancelada",
                description: response.motivoCancelamento === 4 
                  ? "Sua consulta expirou por tempo de espera. Seu crédito foi restaurado."
                  : "A consulta foi cancelada. Seu crédito foi restaurado.",
              });
            } else {
              logger.error("Erro ao restaurar crédito:", error);
              toast({
                title: "Consulta Cancelada",
                description: "A consulta foi cancelada.",
                variant: "destructive",
              });
            }
          } catch (restoreError) {
            logger.error("Erro ao restaurar crédito:", restoreError);
            toast({
              title: "Consulta Cancelada",
              description: "Esta consulta foi cancelada.",
              variant: "destructive",
            });
          }
          
          setTimeout(() => {
            navigate('/teleconsultas');
          }, 3000);
        }
      } catch (err) {
        // Silently fail - não interrompe a consulta se houver erro no polling
        console.error('[SalaEspera] Erro ao verificar status da consulta:', err);
      }
    };

    // Verifica imediatamente e depois a cada 10 segundos
    checkConsultationStatus();
    const interval = setInterval(checkConsultationStatus, 10000);

    return () => clearInterval(interval);
  }, [atendimentoId, toast, navigate]);

  const handleEnter = async () => {
    if (!atendimentoId) return;
    setIsLoading(true);
    try {
      const { assemedClient } = await import("@/integrations/assemed/client");
      const fresh = await assemedClient.getConsultation(atendimentoId);
      if (!fresh || !fresh.pacienteToken) {
        toast({ title: "Consulta indisponível", description: "Token do paciente não disponível.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const isSandbox = getIsSandbox();
      const base = isSandbox ? "https://dev-app-assemed.azurewebsites.net" : "https://app.assemedtelemedicina.com";
      const url = `${base}/sala-espera-externa/${atendimentoId}?token=${encodeURIComponent(fresh.pacienteToken)}`;
      setIframeSrc(url);
      setShowEnter(false);
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível obter a consulta.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html, body {
          width: 100%;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(180deg, #f0f7ee 0%, #ffffff 100%);
        }
        .sala-container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .sala-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .waiting-room {
          text-align: center;
          max-width: 480px;
        }
        .waiting-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          background: linear-gradient(135deg, #EDAF00 0%, #CC9B00 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        .waiting-icon svg { width: 40px; height: 40px; fill: white; }
        .waiting-title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 12px; }
        .waiting-description { font-size: 16px; color: #666; margin-bottom: 32px; line-height: 1.6; }
        .waiting-status { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e5e7eb; }
        .status-row { display: grid; grid-template-columns: 24px 1fr auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
        .status-row:last-child { border-bottom: none; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #EDAF00; animation: blink 1.5s ease-in-out infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .status-text { font-size: 14px; color: #6b7280; text-align: left; }
        .status-value { font-size: 14px; font-weight: 600; color: #A67705; text-align: right; }
        .info-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px; }
        .info-card { background: white; border-radius: 12px; padding: 16px; text-align: left; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); border: 1px solid #e5e7eb; }
        .info-card-icon { width: 32px; height: 32px; background: #fff4dd; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
        .info-card-icon svg { width: 18px; height: 18px; fill: #A67705; }
        .info-card-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px; }
        .info-card-desc { font-size: 12px; color: #6b7280; }
        .enter-button { margin-top: 24px; width: 100%; padding: 16px 24px; background: linear-gradient(135deg, #EDAF00 0%, #CC9B00 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.2s, box-shadow 0.2s; }
        .enter-button:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(237, 175, 0, 0.22); }
        .enter-button:active { transform: translateY(0); }
        .enter-button svg { width: 20px; height: 20px; }
        .enter-button.hidden { display: none; }
        .hidden { display: none; }
        @media (max-width: 640px) {
          .header { padding: 12px 16px; }
          .header-title { font-size: 16px; }
          .waiting-title { font-size: 20px; }
          .waiting-description { font-size: 14px; }
          .info-cards { grid-template-columns: 1fr; }
        }
      `}</style>

      <Header
        isAuthenticated
        inIframe={!!iframeSrc}
        onClose={() => { setIframeSrc(null); setShowEnter(true); }}
        onLogout={async () => { await supabase.auth.signOut(); navigate('/auth'); }}
      />

      <div className="mx-auto max-w-4xl px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/teleconsultas')}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      <div className="sala-container">
        <div className="sala-content" id="waitingRoom">
          <div className="waiting-room">
            <div className="waiting-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" fill="currentColor"/>
              </svg>
            </div>

            <h1 className="waiting-title">Sala de Espera</h1>

            <div className="waiting-status">
              <div className="status-row">
                <span className="status-dot" />
                <span className="status-text">Status</span>
                <span className="status-value" id="statusText">{statusLabels[consultationStatus]}</span>
              </div>
              {profissionalNome && (
                <div className="status-row">
                  <span />
                  <span className="status-text">Profissional</span>
                  <span className="status-value">{profissionalNome}</span>
                </div>
              )}
              <div className="status-row">
                <span />
                <span className="status-text">Especialidade</span>
                <span className="status-value" id="specialtyText">{especialidade}</span>
              </div>
              <div className="status-row">
                <span />
                <span className="status-text">ID Atendimento</span>
                <span className="status-value" id="attendanceId">{atendimentoId ? `#${atendimentoId}` : '-'}</span>
              </div>
            </div>

            {/* Primary enter button under the info card: opens iframe logged-in for this consultation */}
            {/* <div className="mt-4">
              <Button onClick={handleEnter} className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={isLoading || !atendimentoId}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Entrando...</>
                ) : (
                  'Entrar na Consulta'
                )}
              </Button>
            </div> */}

            {/* Secondary enter button (kept for compatibility) */}
            <button id="enterButton" className={`enter-button`} onClick={handleEnter}>
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
              {isLoading ? 'Carregando...' : 'Entrar na Consulta'}
            </button>

            <div className="info-cards">
              <div className="info-card">
                <div className="info-card-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <div className="info-card-title">Câmera e Microfone</div>
                <div className="info-card-desc">Mantenha ligados durante a consulta</div>
              </div>

              <div className="info-card">
                <div className="info-card-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                  </svg>
                </div>
                <div className="info-card-title">Ambiente Silencioso</div>
                <div className="info-card-desc">Escolha um local tranquilo</div>
              </div>

              <div className="info-card">
                <div className="info-card-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12z"/>
                  </svg>
                </div>
                <div className="info-card-title">Conexão Estável</div>
                <div className="info-card-desc">Use Wi-Fi ou 4G/5G</div>
              </div>

              <div className="info-card">
                <div className="info-card-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-4H6v-2h4V7h2v4h4v2h-4v4z"/>
                  </svg>
                </div>
                <div className="info-card-title">Documentos</div>
                <div className="info-card-desc">Tenha exames em mãos</div>
              </div>
            </div>
          </div>
        </div>

        {/* Iframe para a consulta real quando conectado (zIndex below header so header stays visible) */}
        <iframe id="consultationFrame" style={{ display: iframeSrc ? "block" : "none", width: "100%", height: "100%", border: "none", position: "fixed", inset: 0, zIndex: 20 }} src={iframeSrc ?? undefined} allow="camera; microphone; fullscreen; display-capture" />
      </div>
    </div>
  );
}
