import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Package, ArrowLeft, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CreditCardForm } from "./CreditCardForm";
import {
  processMedicationPayment,
  processMedicationPixPayment,
  confirmPixPayment,
  toCents,
  type CardData,
  type CustomerData,
} from "@/services/paymentService";
import { toast } from "sonner";
import type { CartItem } from "@/types/prescription";

interface MedicationCheckoutProps {
  items: CartItem[];
  customer: CustomerData;
  onSuccess?: (paymentId: string) => void;
  onCancel?: () => void;
}

export function MedicationCheckout({
  items,
  customer,
  onSuccess,
  onCancel,
}: MedicationCheckoutProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [installments, setInstallments] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "pix">("card");
  const [pixData, setPixData] = useState<{
    paymentId: string;
    qrCode: string;
    qrCodeUrl: string;
    expiresAt: string;
  } | null>(null);
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    paymentId?: string;
    message: string;
  } | null>(null);

  const subtotal = items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const shipping = subtotal > 100 ? 0 : 9.9;
  const total = subtotal + shipping;

  const generateOrderId = () => {
    return `MED-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  };

  const handlePayment = async (cardData: CardData) => {
    setIsLoading(true);

    try {
      const orderId = generateOrderId();
      const result = await processMedicationPayment(
        orderId,
        customer,
        cardData,
        toCents(total),
        parseInt(installments)
      );

      setPaymentResult({
        success: result.success,
        paymentId: result.paymentId,
        message: result.message,
      });

      if (result.success) {
        toast.success("Pagamento realizado com sucesso!");
        onSuccess?.(result.paymentId!);
      } else {
        toast.error(result.message || "Falha no pagamento");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      setPaymentResult({
        success: false,
        message,
      });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePixPayment = async () => {
    setIsLoading(true);

    try {
      const orderId = generateOrderId();
      const result = await processMedicationPixPayment(
        orderId,
        customer,
        toCents(total)
      );

      if (result.paymentId && result.pixQrCode && result.pixQrCodeUrl && result.pixExpiresAt) {
        setPixData({
          paymentId: result.paymentId,
          qrCode: result.pixQrCode,
          qrCodeUrl: result.pixQrCodeUrl,
          expiresAt: result.pixExpiresAt,
        });
        toast.message("PIX gerado", {
          description: "Finalize o pagamento para confirmar o pedido.",
        });
      } else {
        toast.error(result.message || "Falha ao gerar PIX");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePixConfirmation = async () => {
    if (!pixData?.paymentId) return;
    setIsLoading(true);
    try {
      const result = await confirmPixPayment(pixData.paymentId);
      setPaymentResult({
        success: result.success,
        paymentId: result.paymentId,
        message: result.message,
      });

      if (result.success) {
        toast.success("PIX confirmado com sucesso!");
        onSuccess?.(result.paymentId!);
      } else {
        toast.error(result.message || "Pagamento PIX pendente");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (paymentMethod === "card") {
      setPixData(null);
    }
  }, [paymentMethod]);

  const getInstallmentOptions = () => {
    const options = [];
    const maxInstallments = total >= 100 ? 12 : total >= 50 ? 6 : 3;

    for (let i = 1; i <= maxInstallments; i++) {
      const installmentValue = total / i;
      const label =
        i === 1
          ? `À vista - R$ ${total.toFixed(2)}`
          : `${i}x de R$ ${installmentValue.toFixed(2)} sem juros`;
      options.push({ value: i.toString(), label });
    }

    return options;
  };

  if (paymentResult) {
    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {paymentResult.success ? (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-green-600">
                  Pagamento Confirmado!
                </h2>
                <p className="text-muted-foreground">
                  Seu pedido foi processado com sucesso.
                </p>
                <p className="text-sm text-muted-foreground">
                  ID do pagamento: {paymentResult.paymentId}
                </p>
                <div className="bg-muted/50 p-4 rounded-lg w-full">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4" />
                    <span>Previsão de entrega: 2-3 dias úteis</span>
                  </div>
                </div>
                <Button onClick={() => navigate("/dashboard")} className="w-full">
                  Voltar ao Dashboard
                </Button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-red-600">
                  Pagamento não aprovado
                </h2>
                <p className="text-muted-foreground">{paymentResult.message}</p>
                <div className="flex gap-3 w-full">
                  <Button
                    variant="outline"
                    onClick={() => setPaymentResult(null)}
                    className="flex-1"
                  >
                    Tentar novamente
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate("/cart")}
                    className="flex-1"
                  >
                    Voltar ao carrinho
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Resumo do Pedido */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Resumo do Pedido
          </CardTitle>
          <CardDescription>{items.length} item(s) no carrinho</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-start">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.dosage} • Qtd: {item.quantity}
                </p>
              </div>
              <p className="font-medium">
                R$ {(item.price * item.quantity).toFixed(2)}
              </p>
            </div>
          ))}

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Frete</span>
              <span className={shipping === 0 ? "text-green-600" : ""}>
                {shipping === 0 ? "Grátis" : `R$ ${shipping.toFixed(2)}`}
              </span>
            </div>
            {shipping === 0 && (
              <p className="text-xs text-green-600">
                Frete grátis para compras acima de R$ 100
              </p>
            )}
          </div>

          <Separator />

          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Parcelamento</label>
            <Select value={installments} onValueChange={setInstallments}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getInstallmentOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Forma de pagamento</label>
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "card" | "pix")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Cartão de crédito</SelectItem>
                <SelectItem value="pix">PIX (pagamento instantâneo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Formulário de Pagamento */}
      <div className="space-y-4">
        {paymentMethod === "card" ? (
          <CreditCardForm
            onSubmit={(data) =>
              handlePayment({
                cardNumber: data.cardNumber,
                holder: data.holder,
                expirationDate: data.expirationDate,
                securityCode: data.securityCode,
                brand: data.brand,
              })
            }
            isLoading={isLoading}
            submitLabel={`Pagar R$ ${total.toFixed(2)}`}
          />
        ) : (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Pagamento via PIX
              </CardTitle>
              <CardDescription>
                Gere o QR Code e confirme o pagamento para finalizar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pixData ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={pixData.qrCodeUrl}
                      alt="QR Code PIX"
                      className="h-40 w-40"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Expira em {new Date(pixData.expiresAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-xs break-all">
                    {pixData.qrCode}
                  </div>
                  <Button className="w-full" onClick={handlePixConfirmation} disabled={isLoading}>
                    {isLoading ? "Confirmando..." : "Já paguei"}
                  </Button>
                </div>
              ) : (
                <Button className="w-full" onClick={handlePixPayment} disabled={isLoading}>
                  {isLoading ? "Gerando PIX..." : `Gerar PIX de R$ ${total.toFixed(2)}`}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Pagamentos PIX podem levar alguns minutos para confirmação.
              </p>
            </CardContent>
          </Card>
        )}

        <Button
          variant="ghost"
          onClick={onCancel}
          className="w-full max-w-md"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao carrinho
        </Button>
      </div>
    </div>
  );
}
