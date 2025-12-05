import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Star, Users, Sparkles, ArrowRight, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Plan {
  id: string;
  name: string;
  type: string;
  description: string;
  price_monthly: number;
  price_yearly: number | null;
  specialist_consultations_per_year: number;
  includes_checkup: boolean;
  max_dependents: number;
  features: string[];
}

const Plans = () => {
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_monthly", { ascending: true });

      if (error) throw error;
      
      const formattedPlans = data?.map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features as string || '[]')
      })) || [];
      
      setPlans(formattedPlans);
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPlanIcon = (type: string) => {
    switch (type) {
      case "platina":
        return <Sparkles className="h-5 w-5" />;
      case "coletivo":
        return <Users className="h-5 w-5" />;
      default:
        return <Star className="h-5 w-5" />;
    }
  };

  const getPlanColor = (type: string) => {
    switch (type) {
      case "bronze":
        return "from-amber-600 to-amber-400";
      case "prata":
        return "from-slate-400 to-slate-300";
      case "ouro":
        return "from-yellow-500 to-yellow-300";
      case "platina":
        return "from-primary to-accent";
      case "coletivo":
        return "from-accent to-primary";
      default:
        return "from-primary to-accent";
    }
  };

  const isPopular = (type: string) => type === "ouro";

  const formatPrice = (price: number) => {
    return price.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getYearlyDiscount = (monthly: number, yearly: number | null) => {
    if (!yearly) return 0;
    const yearlyFromMonthly = monthly * 12;
    return Math.round(((yearlyFromMonthly - yearly) / yearlyFromMonthly) * 100);
  };

  const faqs = [
    {
      question: "Como funcionam as consultas ilimitadas?",
      answer: "Todos os planos incluem consultas ilimitadas com clínicos gerais 24 horas por dia. Você pode iniciar uma consulta imediata a qualquer momento, sem limite de uso."
    },
    {
      question: "Posso cancelar meu plano a qualquer momento?",
      answer: "Sim, você pode cancelar seu plano a qualquer momento. Para planos mensais, o cancelamento entra em vigor no próximo ciclo de cobrança. Para planos anuais, consulte nossa política de reembolso."
    },
    {
      question: "Como funciona o plano familiar?",
      answer: "O plano Coletivo/Familiar permite incluir até 3 dependentes, que podem ser qualquer familiar (cônjuge, filhos, pais, etc.). Cada dependente terá acesso completo a todos os benefícios do plano."
    },
    {
      question: "Menores de idade podem usar o serviço?",
      answer: "Sim, menores de idade podem utilizar o serviço. Para menores de 12 anos, é obrigatória a presença de um responsável legal durante a consulta."
    },
    {
      question: "Como recebo minha receita médica?",
      answer: "Após a consulta, você recebe um SMS e e-mail com o código da sua receita digital. A receita possui assinatura digital e QR code de validação, sendo aceita em qualquer farmácia."
    },
    {
      question: "Posso mudar de plano depois?",
      answer: "Sim, você pode fazer upgrade ou downgrade do seu plano a qualquer momento. A diferença de valor será calculada proporcionalmente."
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <Badge variant="secondary" className="px-4 py-2">
              Planos acessíveis para todos
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground">
              Escolha o plano ideal{" "}
              <span className="gradient-text">para você</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Consultas ilimitadas com clínico geral 24h em todos os planos. 
              Escolha o que melhor se adapta às suas necessidades.
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
                  Até 17% OFF
                </Badge>
              </Label>
            </div>
          </div>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="py-12 pb-20">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`relative bg-card border-border/50 hover:shadow-elevated transition-all duration-300 flex flex-col ${
                    isPopular(plan.type) ? "border-primary shadow-glow scale-105 z-10" : ""
                  }`}
                >
                  {isPopular(plan.type) && (
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
                          {isYearly && plan.price_yearly
                            ? formatPrice(plan.price_yearly / 12)
                            : formatPrice(plan.price_monthly)}
                        </span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                      </div>
                      {isYearly && plan.price_yearly && (
                        <p className="text-xs text-muted-foreground mt-1">
                          R$ {formatPrice(plan.price_yearly)}/ano
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {getYearlyDiscount(plan.price_monthly, plan.price_yearly)}% OFF
                          </Badge>
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-6 flex-1">
                      {plan.features.map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                      {plan.specialist_consultations_per_year > 0 && (
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">
                            {plan.specialist_consultations_per_year} consulta(s) com especialista/ano
                          </span>
                        </li>
                      )}
                      {plan.includes_checkup && (
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">Check-up anual gratuito</span>
                        </li>
                      )}
                      {plan.max_dependents > 0 && (
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">
                            Até {plan.max_dependents} dependentes
                          </span>
                        </li>
                      )}
                    </ul>

                    <Button
                      className={`w-full ${
                        isPopular(plan.type)
                          ? "gradient-hero text-primary-foreground shadow-glow"
                          : ""
                      }`}
                      variant={isPopular(plan.type) ? "default" : "outline"}
                      onClick={() => navigate("/auth?plan=" + plan.type)}
                    >
                      Assinar Agora
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Single Consultation Option */}
          <Card className="mt-12 bg-muted/50 border-border/50">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-heading font-semibold text-foreground">
                    Consulta Avulsa
                  </h3>
                  <p className="text-muted-foreground">
                    Precisa de uma consulta pontual? Pague apenas pelo atendimento sem compromisso.
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-3xl font-heading font-bold text-foreground">R$ 59,90</p>
                    <p className="text-sm text-muted-foreground">por consulta</p>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/auth?type=avulsa")}>
                    Agendar Consulta
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-muted/30">
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
              {faqs.map((faq, index) => (
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