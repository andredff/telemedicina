import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Package, ArrowLeft, MapPin, CreditCard, QrCode, Truck } from "lucide-react";
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
import { PixPaymentForm } from "./PixPaymentForm";
import { DeliveryAddressForm, type DeliveryAddress } from "./DeliveryAddressForm";
import {
  processMedicationPayment,
  toCents,
  type CardData,
  type CustomerData,
} from "@/services/paymentService";
import { toast } from "sonner";
import type { CartItem, CatalogCartItem } from "@/types/prescription";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { sendOrderStatusNotification, sendLogisticsServiceOrder } from "@/services/notificationService";
import { calculateCartShipping, applyFreeShipping, type ShippingOption, type ShippingConfig } from "@/integrations/correios/client";

type CheckoutStep = "address" | "payment";
type PaymentMethod = "credit_card" | "pix";

interface MedicationCheckoutProps {
  items: CartItem[];
  catalogItems?: CatalogCartItem[];
  customer: CustomerData;
  onSuccess?: (paymentId: string) => void;
  onPrescriptionsPaid?: (receitaIds: string[]) => void;
  onCancel?: () => void;
}

export function MedicationCheckout({
  items,
  catalogItems = [],
  customer,
  onSuccess,
  onPrescriptionsPaid,
  onCancel,
}: MedicationCheckoutProps) {
  // Converte catalogItems → CartItem para exibição/cálculos; receitaId vive em prescriptionId
  const catalogAsCartItems: CartItem[] = catalogItems.map(ci => ({
    cartItemId: ci.cartItemId,
    id: ci.cartItemId,
    prescriptionId: ci.receitaId ?? "",
    quantity: ci.quantity,
    name: ci.name,
    dosage: ci.dosage,
    frequency: "",
    duration: "",
    price: ci.price,
    inStock: true,
  }));
  const allItems = [...items, ...catalogAsCartItems];
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("address");
  const [editingAddress, setEditingAddress] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [installments, setInstallments] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit_card");
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    paymentId?: string;
    orderId?: string;
    message: string;
  } | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);

  const subtotal = allItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  // Calculate shipping based on selected option and admin config
  const shipping = selectedShipping && shippingConfig ? applyFreeShipping(selectedShipping.price, subtotal, shippingConfig) : 0;
  const total = subtotal + shipping;

  // Calculate shipping when address is set
  useEffect(() => {
    const fetchShipping = async () => {
      if (deliveryAddress?.zipCode && allItems.length > 0) {
        setIsCalculatingShipping(true);
        try {
          const { options, config } = await calculateCartShipping(
            deliveryAddress.zipCode,
            allItems.length,
            subtotal
          );
          setShippingOptions(options);
          setShippingConfig(config);

          // Auto-select first option or cheapest
          if (options.length > 0 && !selectedShipping) {
            const cheapest = options.reduce((prev, curr) =>
              curr.price < prev.price ? curr : prev
            );
            setSelectedShipping(cheapest);
          }
        } catch (error) {
          logger.error("Error calculating shipping:", error);
          toast.error("Erro ao calcular o frete");
        } finally {
          setIsCalculatingShipping(false);
        }
      }
    };

    fetchShipping();
  }, [deliveryAddress, items.length, subtotal]);

  const generateOrderId = () => {
    return `MED-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  };

  // Agrupa itens por receitaId para criar pedidos separados
  type OrderGroup = {
    orderId: string;
    receitaId: string | undefined;
    receitaUrlPdf: string | undefined;
    orderItems: { name: string; quantity: number; price: number; receitaId?: string }[];
    groupSubtotal: number;
  };

  function buildOrderGroups(): OrderGroup[] {
    const groups: OrderGroup[] = [];

    // Itens sem receita (CartItem legacy)
    if (items.length > 0) {
      groups.push({
        orderId: generateOrderId(),
        receitaId: undefined,
        receitaUrlPdf: undefined,
        orderItems: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
        groupSubtotal: items.reduce((s, i) => s + i.price * i.quantity, 0),
      });
    }

    // Catalog items agrupados por receitaId
    const byReceita = new Map<string, CatalogCartItem[]>();
    for (const ci of catalogItems) {
      const key = ci.receitaId ?? "__sem-receita__";
      if (!byReceita.has(key)) byReceita.set(key, []);
      byReceita.get(key)!.push(ci);
    }

    for (const [key, groupItems] of byReceita.entries()) {
      const receitaId = key === "__sem-receita__" ? undefined : key;
      // All items in the same group share the same PDF URL — take the first non-null
      const receitaUrlPdf = groupItems.find(i => i.receitaUrlPdf)?.receitaUrlPdf;
      groups.push({
        orderId: generateOrderId(),
        receitaId,
        receitaUrlPdf,
        orderItems: groupItems.map(i => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          receitaId,
        })),
        groupSubtotal: groupItems.reduce((s, i) => s + i.price * i.quantity, 0),
      });
    }

    return groups;
  }

  const saveOrderToDatabase = async (params: {
    orderId: string;
    paymentId: string | null;
    userId: string;
    deliveryAddress: string;
    paymentStatus: "paid" | "pending" | "failed";
    paymentMethod?: "credit_card" | "pix";
    orderItems: { name: string; quantity: number; price: number; receitaId?: string }[];
    orderSubtotal: number;
    orderShipping: number;
    orderTotal: number;
    receitaId?: string;
    receitaUrlPdf?: string;
  }) => {
    try {
      const orderData = {
        id: params.orderId,
        user_id: params.userId,
        date: new Date().toISOString(),
        status: "processing" as const,
        total: params.orderTotal,
        items: params.orderItems,
        delivery_address: params.deliveryAddress,
        payment_id: params.paymentId,
        payment_method: params.paymentMethod || "credit_card",
        installments: parseInt(installments),
        shipping_cost: params.orderShipping,
        subtotal: params.orderSubtotal,
        receita_id: params.receitaId ?? null,
        receita_url_pdf: params.receitaUrlPdf ?? null,
        consulta_id: params.receitaId ?? null, // receitaId == consultationId no modelo Assemed
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

  const saveAllOrders = async (params: {
    paymentId: string | null;
    userId: string;
    deliveryAddress: string;
    paymentStatus: "paid" | "pending" | "failed";
    paymentMethod?: "credit_card" | "pix";
    orderGroups: OrderGroup[];
  }) => {
    const numGroups = params.orderGroups.length || 1;
    const shippingPerGroup = shipping / numGroups;

    for (const group of params.orderGroups) {
      const groupTotal = group.groupSubtotal + shippingPerGroup;
      await saveOrderToDatabase({
        orderId: group.orderId,
        paymentId: params.paymentId,
        userId: params.userId,
        deliveryAddress: params.deliveryAddress,
        paymentStatus: params.paymentStatus,
        paymentMethod: params.paymentMethod,
        orderItems: group.orderItems,
        orderSubtotal: group.groupSubtotal,
        orderShipping: shippingPerGroup,
        orderTotal: groupTotal,
        receitaId: group.receitaId,
        receitaUrlPdf: group.receitaUrlPdf,
      });
    }

    return params.orderGroups[0]?.orderId ?? generateOrderId();
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
        items: allItems.map((i) => ({ name: i.name, quantity: i.quantity })),
      });

      const logisticsResult = await sendLogisticsServiceOrder(orderId, {
        name: customer.name,
        email: customer.email || "",
        phone: "",
        address: addressString,
      }, allItems.map((i) => ({ name: i.name, quantity: i.quantity })));

      if (!logisticsResult.success) {
        logger.error("[LOGISTICS] Pedido salvo, mas a notificação da OS falhou:", logisticsResult.message);
      }
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

      const orderGroups = buildOrderGroups();
      // Use o primeiro orderId para o pagamento
      const primaryOrderId = orderGroups[0]?.orderId ?? generateOrderId();

      // Process payment
      const result = await processMedicationPayment(
        primaryOrderId,
        customer,
        cardData,
        toCents(total),
        parseInt(installments)
      );

      if (result.success && result.paymentId) {
        // Save one order per prescription group
        try {
          await saveAllOrders({
            paymentId: result.paymentId,
            userId: user.id,
            deliveryAddress: deliveryAddressString,
            paymentStatus: "paid",
            orderGroups,
          });

          setPaymentResult({
            success: true,
            paymentId: result.paymentId,
            orderId: primaryOrderId,
            message: result.message,
          });

          await triggerLogisticsNotifications(primaryOrderId);
          const paidReceitaIds = orderGroups
            .map(g => g.receitaId)
            .filter((id): id is string => id !== undefined);
          onPrescriptionsPaid?.(paidReceitaIds);
          toast.success("Pagamento realizado e pedido registrado com sucesso!");
          onSuccess?.(result.paymentId);
        } catch (dbError) {
          logger.error('Payment succeeded but failed to save order:', dbError);
          setPaymentResult({
            success: true,
            paymentId: result.paymentId,
            orderId: primaryOrderId,
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

      const orderGroups = buildOrderGroups();
      const primaryOrderId = await saveAllOrders({
        paymentId: pixPaymentId,
        userId: user.id,
        deliveryAddress: deliveryAddressString,
        paymentStatus: "paid",
        paymentMethod: "pix",
        orderGroups,
      });

      await triggerLogisticsNotifications(primaryOrderId);

      const paidReceitaIds = orderGroups
        .map(g => g.receitaId)
        .filter((id): id is string => id !== undefined);
      onPrescriptionsPaid?.(paidReceitaIds);

      setPaymentResult({
        success: true,
        paymentId: pixPaymentId,
        orderId: primaryOrderId,
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
                    <span>Previsão de entrega: {shippingConfig ? `${shippingConfig.minDeliveryDays} a ${shippingConfig.maxDeliveryDays}` : "1 a 2"} dias úteis</span>
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
              <CardDescription>{allItems.length} item(s) no carrinho</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {allItems.map((item) => (
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
                
                {/* Shipping Options */}
                {deliveryAddress ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Frete</p>
                    {isCalculatingShipping ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        Calculando frete...
                      </div>
                    ) : shippingOptions.length > 0 ? (
                      <RadioGroup
                        value={selectedShipping?.id || ""}
                        onValueChange={(value) => {
                          const option = shippingOptions.find(o => o.id === value);
                          if (option) setSelectedShipping(option);
                        }}
                        className="space-y-2"
                      >
                        {shippingOptions.map((option) => {
                          const finalPrice = applyFreeShipping(option.price, subtotal, shippingConfig || undefined);
                          return (
                            <div key={option.id} className="flex items-center space-x-2">
                              <RadioGroupItem value={option.id} id={`shipping-${option.id}`} />
                              <Label
                                htmlFor={`shipping-${option.id}`}
                                className="flex-1 cursor-pointer"
                              >
                                <div className="flex justify-between">
                                  <span>
                                    <span className="font-medium">{option.name}</span>
                                    <span className="text-muted-foreground text-xs ml-1">
                                      ({shippingConfig ? `${shippingConfig.minDeliveryDays} a ${shippingConfig.maxDeliveryDays}` : "1 a 2"} dias úteis)
                                    </span>
                                  </span>
                                  <span className={finalPrice === 0 ? "text-green-600 font-medium" : ""}>
                                    {finalPrice === 0 ? "Grátis" : `R$ ${finalPrice.toFixed(2)}`}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {option.description}
                                </p>
                              </Label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Não foi possível calcular o frete para este endereço.
                      </p>
                    )}
                    {shippingConfig?.enableFreeShipping && subtotal >= shippingConfig.freeShippingThreshold && (
                      <p className="text-xs text-green-600">
                        Frete grátis para compras acima de R$ {shippingConfig.freeShippingThreshold.toFixed(2)}!
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span>Frete</span>
                    <span className="text-muted-foreground">
                      Informe o endereço para calcular
                    </span>
                  </div>
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
              autoConfirm={!editingAddress}
              onAddressConfirm={(address) => {
                setDeliveryAddress(address);
                setEditingAddress(false);
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
              <CardDescription>{allItems.length} item(s) no carrinho</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {allItems.map((item) => (
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
                
                {/* Selected Shipping */}
                {selectedShipping ? (
                  <div className="flex justify-between text-sm items-center">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{selectedShipping.name}</span>
                        <span className="text-muted-foreground text-xs ml-1">
                          ({shippingConfig ? `${shippingConfig.minDeliveryDays} a ${shippingConfig.maxDeliveryDays}` : "1 a 2"} dias úteis)
                        </span>
                      </div>
                    </div>
                    <span className={shipping === 0 ? "text-green-600 font-medium" : ""}>
                      {shipping === 0 ? "Grátis" : `R$ ${shipping.toFixed(2)}`}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span>Frete</span>
                    <span className="text-muted-foreground">
                      Calcule o frete no passo anterior
                    </span>
                  </div>
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
                  onClick={() => { setEditingAddress(true); setCurrentStep("address"); }}
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
              onClick={() => { setEditingAddress(true); setCurrentStep("address"); }}
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
