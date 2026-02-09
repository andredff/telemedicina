import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Video, AlertCircle, Loader2, X, CheckCircle } from "lucide-react";
import { assemedClient } from "@/integrations/assemed/client";
import { getAssemedCredentials, getWaitingRoomUrl } from "@/integrations/assemed/config";
import { TelemedicineIframe } from "./TelemedicineIframe";

interface TelemedConsultationFrameProps {
  consultationId: number;
  onClose?: () => void;
}

export function TelemedConsultationFrame({
  consultationId,
  onClose,
}: TelemedConsultationFrameProps) {
  const [consultationUrl, setConsultationUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [consultationStatus, setConsultationStatus] = useState<string>("AGUARDANDO");

  useEffect(() => {
    loadConsultation();
    
    // Polling para verificar se a consulta foi finalizada
    const pollInterval = setInterval(checkConsultationStatus, 10000); // a cada 10 segundos
    
    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  const loadConsultation = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Verificar se há token de autenticação
      const token = assemedClient.getAccessToken();
      
      if (!token) {
        throw new Error("Token de autenticação não encontrado. Faça login novamente.");
      }

      // Verificar se token está expirado
      if (assemedClient.isTokenExpired(token)) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      // Buscar detalhes da consulta
      const consultation = await assemedClient.getConsultation(consultationId);
      
      if (!consultation) {
        throw new Error("Consulta não encontrada");
      }

      // Verificar se já foi finalizada
      if (consultation.situacao === "CONCLUIDO" || consultation.situacao === "CANCELADO") {
        setIsFinished(true);
        setConsultationStatus(consultation.situacao);
        setError(`Consulta ${consultation.situacao.toLowerCase()}`);
        return;
      }

      setConsultationStatus(consultation.situacao || "AGUARDANDO");

      // Montar URL da teleconsulta
      // Precisamos do pacienteToken que vem da criação do atendimento
      // Se não tiver no objeto consultation, precisamos usar o token de autenticação
      const credentials = getAssemedCredentials();
      
      // A URL usa o token do paciente (que é o accessToken)
      const url = getWaitingRoomUrl(consultationId, token, credentials.isSandbox);
      
      console.log("[Teleconsulta] URL gerada:", url);
      setConsultationUrl(url);

    } catch (err) {
      console.error("Erro ao carregar teleconsulta:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar consulta");
    } finally {
      setIsLoading(false);
    }
  };

  const checkConsultationStatus = async () => {
    try {
      const status = await assemedClient.getConsultationStatus(consultationId);
      
      setConsultationStatus(status.situacao || "AGUARDANDO");
      
      if (status.situacao === "CONCLUIDO" || status.situacao === "CANCELADO") {
        setIsFinished(true);
        setConsultationUrl(null);
        setError(`Consulta ${status.situacao.toLowerCase()}`);
      }
    } catch (err) {
      console.error("Erro ao verificar status:", err);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Carregando teleconsulta...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !consultationUrl) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isFinished ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Consulta Finalizada
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5" />
                Erro
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant={isFinished ? "default" : "destructive"}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          
          {isFinished && (
            <div className="text-sm text-muted-foreground">
              <p>Você pode visualizar os receituários e documentos na página de histórico de consultas.</p>
            </div>
          )}
          
          {onClose && (
            <Button onClick={onClose} variant="outline" className="w-full">
              Voltar
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative w-full h-screen">
      {/* Cabeçalho com status e botão de fechar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3">
          <Video className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold text-lg">Teleconsulta</h2>
            <p className="text-sm text-muted-foreground">
              Status: {consultationStatus}
            </p>
          </div>
        </div>
        
        {onClose && (
          <Button
            onClick={onClose}
            variant="destructive"
            size="sm"
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Fechar
          </Button>
        )}
      </div>

      {/* Iframe da teleconsulta */}
      {consultationUrl && (
        <div className="pt-20 h-full">
          <TelemedicineIframe
            url={consultationUrl}
            title="Teleconsulta Assemed"
            className="h-full"
          />
        </div>
      )}
    </div>
  );
}
