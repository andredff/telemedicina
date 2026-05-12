import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Crown, ArrowLeft, Calendar, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CreditCardForm } from "./CreditCardForm";
import {
  createSubscription,
  toCents,
  type CardData,
  type CustomerData,
  type RecurrenceInterval,
} from "@/services/paymentService";
import { toast } from "sonner";
import { sendPlanSubscriptionActivated } from "@/services/notificationService";

interface SubscriptionPlan {
  id: string;
  name: string;
  type?: string;
  priceMonthly: number;
  priceYearly?: number;
  features: string[];
  maxDependents?: number;
  specialistConsultationsPerYear?: number;
  includesCheckup?: boolean;
}

interface SubscriptionCheckoutProps {
  plan: SubscriptionPlan;
  customer: CustomerData;
  onSuccess?: (recurrentPaymentId: string, billingCycle: "monthly" | "yearly") => void;
  onCancel?: () => void;
}

export function SubscriptionCheckout({
  plan,
  customer,
  onSuccess,
  onCancel,
}: SubscriptionCheckoutProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    recurrentPaymentId?: string;
    message: string;
  } | null>(null);

  const price = billingCycle === "yearly" && plan.priceYearly
    ? plan.priceYearly
    : plan.priceMonthly;

  const monthlyEquivalent = billingCycle === "yearly" && plan.priceYearly
    ? plan.priceYearly / 12
    : plan.priceMonthly;

  const savings = billingCycle === "yearly" && plan.priceYearly
    ? (plan.priceMonthly * 12) - plan.priceYearly
    : 0;

  const interval: RecurrenceInterval = billingCycle === "yearly" ? "Annual" : "Monthly";

  const handleBillingCycleChange = (value: string) => {
    const cycle = value as "monthly" | "yearly";
    setBillingCycle(cycle);
  };

  const generateSubscriptionId = () =>
    `SUB-${plan.id.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  const handlePayment = async (cardData: CardData) => {
    setIsLoading(true);

    try {
      const subscriptionId = generateSubscriptionId();
      const result = await createSubscription(
        subscriptionId,
        customer,
        cardData,
        toCents(price),
        interval
      );

      setPaymentResult({
        success: result.success,
        recurrentPaymentId: result.recurrentPaymentId,
        message: result.message,
      });

      if (result.success) {
        const nextBillingDate = new Date();
        if (billingCycle === "yearly") {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        } else {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }

        await sendPlanSubscriptionActivated({
          email: customer.email || "",
          nome: customer.name,
          planoNome: plan.name,
          planoTipo: plan.type || plan.id,
          billingCycle,
          price,
          monthlyEquivalent,
          recurrentPaymentId: result.recurrentPaymentId,
          features: plan.features,
          proximoCobranca: nextBillingDate.toLocaleDateString("pt-BR"),
        });

        toast.success("Assinatura ativada com sucesso!");
        onSuccess?.(result.recurrentPaymentId!, billingCycle);
      } else {
        toast.error(result.message || "Falha ao processar assinatura");
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
                  Assinatura Ativada!
                </h2>
                <p className="text-muted-foreground">
                  Bem-vindo ao plano {plan.name}! Sua assinatura está ativa.
                </p>
                <div className="bg-muted/50 p-4 rounded-lg w-full space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Crown className="h-4 w-4 text-primary" />
                    <span>Plano {plan.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Repeat className="h-4 w-4" />
                    <span>
                      Cobrança {billingCycle === "yearly" ? "anual" : "mensal"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Próxima cobrança em{" "}
                      {billingCycle === "yearly" ? "12 meses" : "30 dias"}
                    </span>
                  </div>
                </div>
                <Button onClick={() => navigate("/dashboard")} className="w-full">
                  Ir para o Dashboard
                </Button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-red-600">
                  Não foi possível ativar
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
                    onClick={() => navigate("/planos")}
                    className="flex-1"
                  >
                    Ver outros planos
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
      {/* Detalhes do Plano */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Plano {plan.name}
            </CardTitle>
            {savings > 0 && billingCycle === "yearly" && (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                Economia de R$ {savings.toFixed(2)}
              </Badge>
            )}
          </div>
          <CardDescription>
            Assinatura recorrente com cobrança automática
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Ciclo de cobrança */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Ciclo de cobrança</Label>
            <RadioGroup
              value={billingCycle}
              onValueChange={handleBillingCycleChange}
              className="grid grid-cols-2 gap-4"
            >
              <Label
                htmlFor="monthly"
                className={`flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors ${
                  billingCycle === "monthly"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="monthly" id="monthly" className="sr-only" />
                <span className="text-sm font-medium">Mensal</span>
                <span className="text-2xl font-bold">
                  R$ {plan.priceMonthly.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground">/mês</span>
              </Label>

              {plan.priceYearly && (
                <Label
                  htmlFor="yearly"
                  className={`flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors relative ${
                    billingCycle === "yearly"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value="yearly" id="yearly" className="sr-only" />
                  <Badge className="absolute -top-2 right-2 text-xs">
                    Melhor oferta
                  </Badge>
                  <span className="text-sm font-medium">Anual</span>
                  <span className="text-2xl font-bold">
                    R$ {plan.priceYearly.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">/ano</span>
                  <span className="text-xs text-green-600 mt-1">
                    R$ {(plan.priceYearly / 12).toFixed(2)}/mês
                  </span>
                </Label>
              )}
            </RadioGroup>
          </div>

          <Separator />

          {/* Benefícios */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">O que está incluso</Label>
            <ul className="space-y-2">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          {/* Resumo */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Valor da assinatura</span>
              <span>R$ {price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Frequência</span>
              <span>{billingCycle === "yearly" ? "Anual" : "Mensal"}</span>
            </div>
            {billingCycle === "yearly" && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Você economiza</span>
                <span>R$ {savings.toFixed(2)}/ano</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-bold">
              <span>Cobrança hoje</span>
              <span>R$ {price.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulário de Pagamento */}
      <div className="space-y-4">
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
          submitLabel={`Assinar por R$ ${price.toFixed(2)}${billingCycle === "monthly" ? "/mês" : "/ano"}`}
        />

        <div className="text-center text-xs text-muted-foreground max-w-md">
          <p>
            Ao assinar, você concorda com os{" "}
            <a href="#" className="underline">
              Termos de Serviço
            </a>{" "}
            e{" "}
            <a href="#" className="underline">
              Política de Privacidade
            </a>
            . Você pode cancelar a qualquer momento.
          </p>
        </div>

        <Button
          variant="ghost"
          onClick={onCancel}
          className="w-full max-w-md"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar aos planos
        </Button>
      </div>
    </div>
  );
}
