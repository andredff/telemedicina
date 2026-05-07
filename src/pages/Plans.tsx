import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Star, Users, ArrowRight, HelpCircle, Gem, Crown, Award, Clock, Building, FileCheck, Shield, LucideIcon } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  INDIVIDUAL_PLANS,
  COLETIVO_PLANS,
  SINGLE_CONSULTATION_PRICES,
  ANNUAL_DISCOUNT,
  formatPrice,
  getPlanColor,
  getFeaturesForBilling,
  PlanData,
} from "@/data/plansData";
import { FAQ_ITEMS, DIFERENCIAIS } from "@/data/landingContent";


// Plan icon mapping based on plan type
const PLAN_ICONS: Record<string, LucideIcon> = {
  diamante: Gem,
  ouro: Crown,
  coletivo: Users,
  default: Star,
};

function getPlanIcon(type: string): JSX.Element {
  const iconKey = Object.keys(PLAN_ICONS).find((key) => type.includes(key)) ?? "default";
  const IconComponent = PLAN_ICONS[iconKey];
  return <IconComponent className="h-5 w-5" />;
}

// Icon mapping for DIFERENCIAIS section
const DIFERENCIAIS_ICONS: Record<string, LucideIcon> = {
  Award: Award,
  Clock: Clock,
  Building: Building,
  FileCheck: FileCheck,
  Shield: Shield,
  Star: Star,
};

function getDiferenciaisIcon(iconName: string): LucideIcon {
  return DIFERENCIAIS_ICONS[iconName] || Star;
}

// Reusable feature list item component
function FeatureItem({ text, highlighted = false }: { text: string; highlighted?: boolean }): JSX.Element {
  return (
    <li className="flex items-start gap-2 text-sm">
      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
      <span className={highlighted ? "text-foreground font-medium" : "text-muted-foreground"}>
        {text}
      </span>
    </li>
  );
}

// Single consultation options data
const SINGLE_CONSULTATION_OPTIONS = [
  {
    title: "Consulta Avulsa - Clínico Geral",
    description: "Consulta pontual com médico clínico geral, sem compromisso.",
    priceKey: "clinico_geral" as const,
    authParam: "avulsa-clinico",
  },
  {
    title: "Consulta Avulsa - Especialista",
    description: "Consulta pontual com médico especialista para assinantes.",
    priceKey: "especialista" as const,
    authParam: "avulsa-especialista",
  },
];

function Plans(): JSX.Element {
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  const [activeTab, setActiveTab] = useState<"individual" | "coletivo">("individual");

  function getPrice(plan: PlanData): number {
    if (isYearly) {
      return plan.price_yearly / 12;
    }
    return plan.price_monthly;
  }

  const currentPlans = activeTab === "individual" ? INDIVIDUAL_PLANS : COLETIVO_PLANS;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <Badge variant="secondary" className="px-4 py-2">
              Por menos de R$ 1,00 por dia
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground">
              Escolha o plano ideal{" "}
              <span className="gradient-text">para você</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Consultas ilimitadas com clínico geral 24h em todos os planos.
              Planos individuais ou familiares com até 3 beneficiários.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <Label
                htmlFor="billing-toggle"
                className={`text-sm font-medium ${!isYearly ? "text-foreground" : "text-muted-foreground"}`}
              >
                Mensal
              </Label>
              <Switch
                id="billing-toggle"
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <Label
                htmlFor="billing-toggle"
                className={`text-sm font-medium ${isYearly ? "text-foreground" : "text-muted-foreground"}`}
              >
                Anual
                <Badge className="ml-2 bg-accent text-accent-foreground">
                  {Math.round(ANNUAL_DISCOUNT * 100)}% OFF
                </Badge>
              </Label>
            </div>
          </div>
        </div>
      </section>

      {/* Plan Type Tabs */}
      <section className="pb-8">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'individual' | 'coletivo')} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="individual" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Individual
              </TabsTrigger>
              <TabsTrigger value="coletivo" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Familiar (até 3)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="individual" className="mt-8">
              <p className="text-center text-muted-foreground mb-8">
                Planos para uso individual com consultas ilimitadas 24h.
              </p>
            </TabsContent>

            <TabsContent value="coletivo" className="mt-8">
              <p className="text-center text-muted-foreground mb-8">
                Planos familiares para até 3 beneficiários (titular + 2 dependentes).
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="py-12 pb-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {currentPlans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative bg-card border-border/50 hover:shadow-elevated transition-all duration-300 flex flex-col ${
                  plan.highlight ? "border-primary shadow-glow scale-105 z-10" : ""
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="gradient-hero text-primary-foreground px-4 py-1 shadow-lg">
                      Mais Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getPlanColor(plan.type)} flex items-center justify-center text-white mb-4`}>
                    {getPlanIcon(plan.type)}
                  </div>
                  <CardTitle className="text-xl font-heading">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <span className="text-4xl font-heading font-bold text-foreground">
                        {formatPrice(getPrice(plan))}
                      </span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    {isYearly && (
                      <p className="text-xs text-muted-foreground mt-1">
                        R$ {formatPrice(plan.price_yearly)}/ano
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Economia de R$ {formatPrice(plan.price_monthly * 12 - plan.price_yearly)}
                        </Badge>
                      </p>
                    )}
                    {!isYearly && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Cobrado em 12x de R$ {formatPrice(plan.price_monthly)}
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6 flex-1">
                    {getFeaturesForBilling(plan, isYearly ? 'yearly' : 'monthly').map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${
                      plan.highlight
                        ? "gradient-hero text-primary-foreground shadow-glow"
                        : ""
                    }`}
                    variant={plan.highlight ? "default" : "outline"}
                    onClick={() => navigate(`/auth?plan=${plan.type}&billing=${isYearly ? 'yearly' : 'monthly'}`)}
                  >
                    Assinar Agora
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            * Programa "Medicamento em Casa" disponível no DF e região do entorno. Outras regiões em breve.
          </p>

          {/* Single Consultation Options */}
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            {SINGLE_CONSULTATION_OPTIONS.map((option) => (
              <Card key={option.priceKey} className="bg-muted/50 border-border/50">
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-heading font-semibold text-foreground">
                        {option.title}
                      </h3>
                      <p className="text-muted-foreground">{option.description}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-3xl font-heading font-bold text-foreground">
                          R$ {formatPrice(SINGLE_CONSULTATION_PRICES[option.priceKey])}
                        </p>
                        <p className="text-sm text-muted-foreground">por consulta</p>
                      </div>
                      <Button variant="outline" onClick={() => navigate(`/checkout/consultation?type=${option.priceKey}`)}>
                        Adquirir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Payment Info */}
          <div className="mt-8 p-6 bg-muted/30 rounded-2xl border border-border/50">
            <h4 className="font-heading font-semibold text-foreground mb-4">Informações sobre pagamento:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <FeatureItem text="Pagamento mensal: Cobrado em 12 parcelas do valor apresentado (vide política de cancelamento)." />
              <FeatureItem text={`Pagamento anual: Cobrado em uma única vez com ${Math.round(ANNUAL_DISCOUNT * 100)}% de desconto.`} />
              <FeatureItem text="Aceitamos cartão de crédito e PIX." />
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-10 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <HelpCircle className="h-4 w-4" />
              <span>Perguntas Frequentes</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
              Tire suas dúvidas
            </h2>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {FAQ_ITEMS.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-card border border-border/50 rounded-xl px-6 data-[state=open]:shadow-card"
                >
                  <AccordionTrigger className="text-left font-heading font-semibold hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Plans;
