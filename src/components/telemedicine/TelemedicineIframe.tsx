import { useState } from "react";
import { Loader2, AlertCircle, RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TelemedicineIframeProps {
  url: string;
  title?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function TelemedicineIframe({
  url,
  title = "Telemedicina Novita",
  className = "",
  onLoad,
  onError,
}: TelemedicineIframeProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setKey((prev) => prev + 1);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-lg">
        <Alert variant="destructive" className="mb-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar a plataforma de telemedicina.
            Por favor, verifique sua conexao e tente novamente.
          </AlertDescription>
        </Alert>
        <Button onClick={handleRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-50 bg-background"
    : `relative ${className}`;

  const iframeClasses = isFullscreen
    ? "w-full h-full"
    : "w-full h-full min-h-[600px] rounded-lg";

  return (
    <div className={containerClasses}>
      {/* Header quando em fullscreen */}
      {isFullscreen && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur border-b">
          <h2 className="font-semibold text-lg">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 rounded-lg">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Carregando telemedicina...
            </p>
          </div>
        </div>
      )}

      {/* Botao de fullscreen quando nao esta em fullscreen */}
      {!isFullscreen && !isLoading && (
        <Button
          variant="outline"
          size="icon"
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 z-10 h-8 w-8 bg-background/80 backdrop-blur"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}

      {/* iFrame */}
      <iframe
        key={key}
        src={url}
        title={title}
        className={iframeClasses}
        style={isFullscreen ? { paddingTop: "60px" } : undefined}
        onLoad={handleLoad}
        onError={handleError}
        allow="camera; microphone; display-capture; fullscreen"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
