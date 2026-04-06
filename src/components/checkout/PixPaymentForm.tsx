import { useState, useEffect, useCallback } from "react";
import { QrCode, Clock, Copy, CheckCircle, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  processMedicationPixPayment,
  getPixPaymentStatus,
  confirmPixPayment,
  type CustomerData,
  type PaymentResult,
  toCents,
} from "@/services/paymentService";

type PixGenerator = (orderId: string, customer: CustomerData, amountInCents: number) => Promise<PaymentResult>;
type PixStatusChecker = (paymentId: string) => Promise<PaymentResult>;
type PixConfirmer = (paymentId: string) => Promise<PaymentResult>;

interface PixPaymentFormProps {
  total: number;
  orderId: string;
  customer: CustomerData;
  onSuccess: (paymentId: string) => void;
  isLoading?: boolean;
  setIsLoading?: (loading: boolean) => void;
  generatePayment?: PixGenerator;
  checkStatus?: PixStatusChecker;
  confirmPayment?: PixConfirmer;
}

type PixState = "idle" | "generating" | "waiting" | "confirmed" | "expired" | "error";

export function PixPaymentForm({
  total,
  orderId,
  customer,
  onSuccess,
  isLoading = false,
  setIsLoading,
  generatePayment = processMedicationPixPayment,
  checkStatus = getPixPaymentStatus,
  confirmPayment = confirmPixPayment,
}: PixPaymentFormProps) {
  const [pixState, setPixState] = useState<PixState>("idle");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || pixState !== "waiting") return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setPixState("expired");
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, pixState]);

  // Poll payment status while waiting
  useEffect(() => {
    if (pixState !== "waiting" || !paymentId) return;

    const interval = setInterval(async () => {
      const status = await checkStatus(paymentId);
      if (status.success) {
        setPixState("confirmed");
        onSuccess(paymentId);
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pixState, paymentId, onSuccess, checkStatus]);

  const generatePix = useCallback(async () => {
    setPixState("generating");
    setIsLoading?.(true);

    try {
      const result = await generatePayment(
        orderId,
        customer,
        toCents(total)
      );

      if (result.paymentId && result.pixQrCodeUrl) {
        setPaymentId(result.paymentId);
        setQrCodeUrl(result.pixQrCodeUrl);
        setPixCode(result.pixQrCode || null);
        setExpiresAt(result.pixExpiresAt || null);
        setPixState("waiting");
      } else {
        setPixState("error");
        toast.error("Erro ao gerar QR Code PIX");
      }
    } catch {
      setPixState("error");
      toast.error("Erro ao gerar PIX");
    } finally {
      setIsLoading?.(false);
    }
  }, [orderId, customer, total, setIsLoading, generatePayment]);

  const handleCopyCode = () => {
    if (pixCode) {
      navigator.clipboard.writeText(pixCode);
      toast.success("Código PIX copiado!");
    }
  };

  const handleSimulatePayment = async () => {
    if (!paymentId) return;
    setIsLoading?.(true);
    const result = await confirmPayment(paymentId);
    setIsLoading?.(false);
    if (result.success) {
      setPixState("confirmed");
      onSuccess(paymentId);
      toast.success("Pagamento PIX confirmado!");
    } else {
      toast.error(result.message);
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Pagamento via PIX
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pixState === "idle" && (
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-muted/50 p-6 rounded-lg text-center space-y-3">
              <QrCode className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Pague instantaneamente com PIX. O QR Code será gerado após clicar no botão abaixo.
              </p>
              <p className="text-lg font-bold">R$ {total.toFixed(2)}</p>
            </div>
            <Button onClick={generatePix} className="w-full" disabled={isLoading}>
              Gerar QR Code PIX
            </Button>
          </div>
        )}

        {pixState === "generating" && (
          <div className="flex flex-col items-center space-y-4 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Gerando QR Code PIX...</p>
          </div>
        )}

        {pixState === "waiting" && (
          <div className="flex flex-col items-center space-y-4">
            {/* QR Code */}
            <div className="bg-white p-4 rounded-lg border">
              {qrCodeUrl && (
                <img
                  src={qrCodeUrl}
                  alt="QR Code PIX"
                  className="w-40 h-40 sm:w-60 sm:h-60 mx-auto"
                />
              )}
            </div>

            {/* Timer */}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>Expira em: <strong>{formatTime(timeLeft)}</strong></span>
            </div>

            {/* Valor */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Valor a pagar</p>
              <p className="text-2xl font-bold">R$ {total.toFixed(2)}</p>
            </div>

            {/* Copiar codigo */}
            {pixCode && (
              <Button
                variant="outline"
                onClick={handleCopyCode}
                className="w-full"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar código PIX
              </Button>
            )}

            {/* Aguardando pagamento */}
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg w-full">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <div className="h-3 w-3 animate-pulse rounded-full bg-amber-500" />
                Aguardando confirmação do pagamento...
              </div>
            </div>

            {/* Botao simulacao (apenas em desenvolvimento) */}
            {import.meta.env.DEV && (
              <Button
                variant="secondary"
                onClick={handleSimulatePayment}
                className="w-full text-xs"
                size="sm"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Simular confirmação do pagamento (dev)
              </Button>
            )}
          </div>
        )}

        {pixState === "confirmed" && (
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-green-600">PIX Confirmado!</h3>
            <p className="text-sm text-muted-foreground">
              Seu pagamento foi recebido com sucesso.
            </p>
          </div>
        )}

        {pixState === "expired" && (
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-red-600">PIX Expirado</h3>
            <p className="text-sm text-muted-foreground">
              O tempo para pagamento expirou. Gere um novo QR Code.
            </p>
            <Button onClick={generatePix} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Gerar novo QR Code
            </Button>
          </div>
        )}

        {pixState === "error" && (
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-red-600">Erro</h3>
            <p className="text-sm text-muted-foreground">
              Não foi possível gerar o QR Code PIX. Tente novamente.
            </p>
            <Button onClick={generatePix} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <QrCode className="h-4 w-4 flex-shrink-0" />
          <span>Abra o app do seu banco, escaneie o QR Code ou cole o código PIX para pagar.</span>
        </div>
      </CardContent>
    </Card>
  );
}
