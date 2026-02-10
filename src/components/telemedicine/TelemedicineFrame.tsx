import { useState } from "react";
import { Loader2, AlertCircle, RefreshCw, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getWhiteLabelConsultationUrl } from "@/integrations/assemed/config";

interface TelemedicineFrameProps {
  accessToken: string;
  tipoConsulta?: "imediata" | "agendada";
  onClose?: () => void;
  title?: string;
}

export function TelemedicineFrame({
  accessToken,
  tipoConsulta = "imediata",
  onClose,
  title = "Telemedicina Novità",
}: TelemedicineFrameProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [key, setKey] = useState(0);

  const iframeUrl = getWhiteLabelConsultationUrl(accessToken, tipoConsulta);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setKey((prev) => prev + 1);
  };

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-lg">
        <Alert variant="destructive" className="mb-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar a plataforma de telemedicina.
            Por favor, verifique sua conexão e tente novamente.
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button onClick={handleRetry} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="ghost">
              Fechar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[600px] bg-background rounded-lg overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg">{title}</h2>
          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
            {tipoConsulta === "imediata" ? "Consulta Imediata" : "Agendar Consulta"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={iframeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir em nova aba
          </a>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Carregando telemedicina...
            </p>
          </div>
        </div>
      )}

      {/* Iframe */}
      <iframe
        key={key}
        src={iframeUrl}
        title={title}
        className="w-full h-full pt-16 border-0"
        onLoad={handleLoad}
        onError={handleError}
        allow="camera; microphone; fullscreen; display-capture"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
