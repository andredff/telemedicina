import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Package, ArrowLeft, MapPin, CreditCard, QrCode } from "lucide-react";
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
import { PixPaymentForm } from "./PixPaymentForm";
import { DeliveryAddressForm, type DeliveryAddress } from "./DeliveryAddressForm";
import {
  processMedicationPayment,
  toCents,
  type CardData,
  type CustomerData,
} from "@/services/paymentService";
import { toast } from "sonner";
import type { CartItem } from "@/types/prescription";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { sendOrderStatusNotification, sendLogisticsServiceOrder } from "@/services/notificationService";

type CheckoutStep = "address" | "payment";
type PaymentMethod = "credit_card" | "pix";

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit_card");
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
    paymentStatus: "paid" | "pending" | "failed";
    paymentMethod?: "credit_card" | "pix";
    pixQrCode?: string | null;
    pixQrCodeUrl?: string | null;
    pixExpiresAt?: string | null;
  }) => {
    try {
      const orderData = {
        id: params.orderId,
        user_id: params.userId,
        date: new Date().toISOString(),
        status: "processing" as const,
        total: total,
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        delivery_address: params.deliveryAddress,
        payment_id: params.paymentId,
        payment_method: params.paymentMethod || "credit_card",
        payment_status: params.paymentStatus,
        pix_qr_code: params.pixQrCode || null,
        pix_qr_code_url: params.pixQrCodeUrl || null,
        pix_expires_at: params.pixExpiresAt || null,
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

  const triggerLogisticsNotifications = async (orderId: string) => {
    if (!deliveryAddress || !customer) return;
    try {
      const addressString = `${deliveryAddress.street}, ${deliveryAddress.number}${deliveryAddress.complement ? ` - ${deliveryAddress.complement}` : ""}, ${deliveryAddress.neighborhood}, ${deliveryAddress.city} - ${deliveryAddress.state}, ${deliveryAddress.zipCode}`;

      await sendOrderStatusNotification({
        orderId,
        customerEmail: customer.email || "",
        customerName: customer.name,
        status: "pending",
        items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
      });

      await sendLogisticsServiceOrder(orderId, {
        name: customer.name,
        email: customer.email || "",
        phone: "",
        address: addressString,
      }, items.map((i) => ({ name: i.name, quantity: i.quantity })));
    } catch (err) {
      logger.warn("Falha ao enviar notificações de logística (não bloqueante):", err);
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
            paymentStatus: "paid",
          });
          
          setPaymentResult({
            success: true,
            paymentId: result.paymentId,
            orderId: orderId,
            message: result.message,
          });

          await triggerLogisticsNotifications(orderId);
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

  const handlePixSuccess = async (pixPaymentId: string) => {
    if (!deliveryAddress) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const deliveryAddressString = `${deliveryAddress.street}, ${deliveryAddress.number}${deliveryAddress.complement ? ` - ${deliveryAddress.complement}` : ""}, ${deliveryAddress.neighborhood}, ${deliveryAddress.city} - ${deliveryAddress.state}, ${deliveryAddress.zipCode}`;

      const orderId = generateOrderId();

      await saveOrderToDatabase({
        orderId,
        paymentId: pixPaymentId,
        userId: user.id,
        deliveryAddress: deliveryAddressString,
        paymentStatus: "paid",
        paymentMethod: "pix",
      });

      await triggerLogisticsNotifications(orderId);

      setPaymentResult({
        success: true,
        paymentId: pixPaymentId,
        orderId,
        message: "Pagamento PIX confirmado!",
      });

      toast.success("Pagamento PIX confirmado e pedido registrado!");
      onSuccess?.(pixPaymentId);
    } catch (error) {
      logger.error("PIX payment succeeded but failed to save order:", error);
      setPaymentResult({
        success: true,
        paymentId: pixPaymentId,
        message: "Pagamento aprovado, mas houve um erro ao registrar o pedido. Entre em contato com o suporte.",
      });
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
                <div key={item.cartItemId} className="flex justify-between items-start">
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
              variant="default"
              onClick={() => setCurrentStep("payment")}
              className="w-full"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Ir para Pagamento
            </Button>

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
            {/* Seleção de Método de Pagamento */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("credit_card")}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  paymentMethod === "credit_card"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <CreditCard className="h-5 w-5" />
                <span className="font-medium text-sm">Cartão</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("pix")}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  paymentMethod === "pix"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <QrCode className="h-5 w-5" />
                <span className="font-medium text-sm">PIX</span>
              </button>
            </div>

            {paymentMethod === "credit_card" ? (
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
              <PixPaymentForm
                total={total}
                orderId={generateOrderId()}
                customer={customer}
                onSuccess={handlePixSuccess}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
              />
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
