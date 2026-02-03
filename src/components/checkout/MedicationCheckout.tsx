import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Package, ArrowLeft, MapPin, CreditCard, QrCode, Clock } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCardForm } from "./CreditCardForm";
import { DeliveryAddressForm, type DeliveryAddress } from "./DeliveryAddressForm";
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
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

type CheckoutStep = "address" | "payment";

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
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("address");
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [installments, setInstallments] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "pix">("card");
  const [pixPayment, setPixPayment] = useState<{
    paymentId: string;
    orderId: string;
    qrCode: string;
    qrCodeUrl: string;
    expiresAt: string;
  } | null>(null);
  const [isPixCreating, setIsPixCreating] = useState(false);
  const [isPixConfirming, setIsPixConfirming] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    paymentId?: string;
    orderId?: string;
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

  const saveOrderToDatabase = async (params: {
    orderId: string;
    paymentId: string | null;
    userId: string;
    deliveryAddress: string;
    paymentMethod: "credit_card" | "pix";
    paymentStatus: "paid" | "pending" | "failed";
    pix?: {
      qrCode: string;
      qrCodeUrl: string;
      expiresAt: string;
    };
  }) => {
    try {
      const orderData = {
        id: params.orderId,
        user_id: params.userId,
        date: new Date().toISOString(),
        status: params.paymentMethod === "pix" ? "pending" : "processing",
        total: total,
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        delivery_address: params.deliveryAddress,
        payment_id: params.paymentId,
        payment_method: params.paymentMethod,
        payment_status: params.paymentStatus,
        pix_qr_code: params.pix?.qrCode || null,
        pix_qr_code_url: params.pix?.qrCodeUrl || null,
        pix_expires_at: params.pix?.expiresAt || null,
        installments: parseInt(installments),
        shipping_cost: shipping,
        subtotal: subtotal,
        customer_name: customer.name || null,
        customer_email: customer.email || null,
      };

      const { data, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) {
        logger.error('Error saving order to database:', error);
        throw error;
      }

      logger.info('Order saved successfully:', data);
      return data;
    } catch (error) {
      logger.error('Failed to save order:', error);
      throw error;
    }
  };

  const handlePayment = async (cardData: CardData) => {
    if (!deliveryAddress) {
      toast.error("Por favor, confirme o endereço de entrega primeiro.");
      return;
    }

    setIsLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Format delivery address for storage
      const deliveryAddressString = `${deliveryAddress.street}, ${deliveryAddress.number}${deliveryAddress.complement ? ` - ${deliveryAddress.complement}` : ''}, ${deliveryAddress.neighborhood}, ${deliveryAddress.city} - ${deliveryAddress.state}, ${deliveryAddress.zipCode}`;

      const orderId = generateOrderId();
      
      // Process payment
      const result = await processMedicationPayment(
        orderId,
        customer,
        cardData,
        toCents(total),
        parseInt(installments)
      );

      if (result.success && result.paymentId) {
        // Save order to database
        try {
          await saveOrderToDatabase({
            orderId,
            paymentId: result.paymentId,
            userId: user.id,
            deliveryAddress: deliveryAddressString,
            paymentMethod: "credit_card",
            paymentStatus: "paid",
          });
          
          setPaymentResult({
            success: true,
            paymentId: result.paymentId,
            orderId: orderId,
            message: result.message,
          });

          toast.success("Pagamento realizado e pedido registrado com sucesso!");
          onSuccess?.(result.paymentId);
        } catch (dbError) {
          logger.error('Payment succeeded but failed to save order:', dbError);
          setPaymentResult({
            success: true,
            paymentId: result.paymentId,
            orderId: orderId,
            message: 'Pagamento aprovado, mas houve um erro ao registrar o pedido. Entre em contato com o suporte.',
          });
          toast.warning("Pagamento aprovado, mas houve um erro ao salvar o pedido.");
        }
      } else {
        setPaymentResult({
          success: false,
          message: result.message,
        });
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
    if (!deliveryAddress) {
      toast.error("Por favor, confirme o endereço de entrega primeiro.");
      return;
    }

    setIsPixCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const deliveryAddressString = `${deliveryAddress.street}, ${deliveryAddress.number}${deliveryAddress.complement ? ` - ${deliveryAddress.complement}` : ''}, ${deliveryAddress.neighborhood}, ${deliveryAddress.city} - ${deliveryAddress.state}, ${deliveryAddress.zipCode}`;
      const orderId = generateOrderId();

      const result = await processMedicationPixPayment(
        orderId,
        customer,
        toCents(total)
      );

      if (!result.paymentId || !result.pixQrCode || !result.pixQrCodeUrl || !result.pixExpiresAt) {
        throw new Error(result.message || "Falha ao gerar PIX");
      }

      await saveOrderToDatabase({
        orderId,
        paymentId: result.paymentId,
        userId: user.id,
        deliveryAddress: deliveryAddressString,
        paymentMethod: "pix",
        paymentStatus: "pending",
        pix: {
          qrCode: result.pixQrCode,
          qrCodeUrl: result.pixQrCodeUrl,
          expiresAt: result.pixExpiresAt,
        },
      });

      setPixPayment({
        paymentId: result.paymentId,
        orderId,
        qrCode: result.pixQrCode,
        qrCodeUrl: result.pixQrCodeUrl,
        expiresAt: result.pixExpiresAt,
      });

      toast.success("PIX gerado! Aguardando pagamento.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar PIX";
      toast.error(message);
    } finally {
      setIsPixCreating(false);
    }
  };

  const handlePixConfirmation = async () => {
    if (!pixPayment) return;

    setIsPixConfirming(true);

    try {
      const result = await confirmPixPayment(pixPayment.paymentId);

      if (result.success) {
        // Atualiza status do pedido no banco
        const { error } = await supabase
          .from("orders")
          .update({
            status: "processing",
            payment_status: "paid",
            payment_id: pixPayment.paymentId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pixPayment.orderId);

        if (error) {
          throw error;
        }

        setPaymentResult({
          success: true,
          paymentId: pixPayment.paymentId,
          orderId: pixPayment.orderId,
          message: "Pagamento PIX confirmado!",
        });

        toast.success("Pagamento PIX confirmado!");
        onSuccess?.(pixPayment.paymentId);
      } else {
        setPaymentResult({
          success: false,
          paymentId: pixPayment.paymentId,
          orderId: pixPayment.orderId,
          message: result.message || "PIX ainda não confirmado.",
        });
        toast.error(result.message || "PIX ainda não confirmado.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao confirmar PIX";
      toast.error(message);
    } finally {
      setIsPixConfirming(false);
    }
  };

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
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className={`flex items-center gap-2 ${currentStep === "address" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "address" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            {currentStep === "payment" ? <CheckCircle className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
          </div>
          <span className="font-medium">Endereço</span>
        </div>
        <div className="w-12 h-0.5 bg-border" />
        <div className={`flex items-center gap-2 ${currentStep === "payment" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "payment" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <CreditCard className="h-5 w-5" />
          </div>
          <span className="font-medium">Pagamento</span>
        </div>
      </div>

      {currentStep === "address" ? (
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
            </CardContent>
          </Card>

          {/* Formulário de Endereço */}
          <div className="space-y-4">
            <DeliveryAddressForm
              onAddressConfirm={(address) => {
                setDeliveryAddress(address);
                setCurrentStep("payment");
              }}
              onCancel={onCancel}
            />

            <Button
              variant="ghost"
              onClick={onCancel}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao carrinho
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Resumo do Pedido com Endereço */}
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

              <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço de Entrega
                </p>
                {deliveryAddress && (
                  <p className="text-sm text-muted-foreground">
                    {deliveryAddress.street}, {deliveryAddress.number}
                    {deliveryAddress.complement && ` - ${deliveryAddress.complement}`}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {deliveryAddress?.neighborhood}, {deliveryAddress?.city} - {deliveryAddress?.state}
                </p>
                <p className="text-sm text-muted-foreground">
                  CEP: {deliveryAddress?.zipCode}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setCurrentStep("address")}
                  className="h-auto p-0 text-primary"
                >
                  Alterar endereço
                </Button>
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
            </CardContent>
          </Card>

          {/* Formulário de Pagamento */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Forma de pagamento</CardTitle>
                <CardDescription>Escolha como deseja pagar</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as "card" | "pix")}
                  className="grid grid-cols-2 gap-4"
                >
                  <Label
                    htmlFor="payment-card"
                    className={`flex items-center justify-center gap-2 p-4 border rounded-lg cursor-pointer transition-colors ${
                      paymentMethod === "card"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem value="card" id="payment-card" className="sr-only" />
                    <CreditCard className="h-4 w-4" />
                    Cartão
                  </Label>
                  <Label
                    htmlFor="payment-pix"
                    className={`flex items-center justify-center gap-2 p-4 border rounded-lg cursor-pointer transition-colors ${
                      paymentMethod === "pix"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem value="pix" id="payment-pix" className="sr-only" />
                    <QrCode className="h-4 w-4" />
                    PIX
                  </Label>
                </RadioGroup>
              </CardContent>
            </Card>

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
              <Card>
                <CardHeader>
                  <CardTitle>Pagamento via PIX</CardTitle>
                  <CardDescription>Gere o QR Code e finalize o pagamento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pixPayment ? (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-lg border p-3 bg-white">
                          <img
                            src={pixPayment.qrCodeUrl}
                            alt="QR Code PIX"
                            className="h-48 w-48"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground text-center">
                          Escaneie o QR Code no seu app bancário ou copie o código abaixo.
                        </p>
                        <div className="w-full rounded-lg border p-3 text-xs break-all bg-muted/30">
                          {pixPayment.qrCode}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Válido até {new Date(pixPayment.expiresAt).toLocaleTimeString("pt-BR")}
                        </div>
                      </div>

                      <Button
                        onClick={handlePixConfirmation}
                        className="w-full"
                        disabled={isPixConfirming}
                      >
                        {isPixConfirming ? "Confirmando pagamento..." : "Já paguei"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => setPixPayment(null)}
                        className="w-full"
                      >
                        Gerar novo PIX
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handlePixPayment}
                      disabled={isPixCreating}
                      className="w-full"
                    >
                      {isPixCreating ? "Gerando PIX..." : `Gerar PIX de R$ ${total.toFixed(2)}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            <Button
              variant="outline"
              onClick={() => setCurrentStep("address")}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao endereço
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
