import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubscriptionCheckout } from "@/components/checkout";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import type { CustomerData } from "@/services/paymentService";
import { useToast } from "@/hooks/use-toast";

interface Plan {
  id: string;
  name: string;
  type: string;
  description: string;
  price_monthly: number;
  price_yearly: number | null;
  features: string[];
  specialist_consultations_per_year: number;
  includes_checkup: boolean;
  max_dependents: number;
}

const CheckoutSubscription = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planType = searchParams.get("plan");
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; email: string; cpf?: string } | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<{ plan_id: string; plan_type: string } | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        // Get CPF from user metadata
        const userData = await supabase.auth.getUser();
        const cpf = userData.data.user?.user_metadata?.cpf;
        setProfile({ ...data, cpf });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  }, []);

  const fetchCurrentSubscription = useCallback(async (userId: string) => {
    try {
      const { data: subscription } = await supabase
        .from("user_subscriptions")
        .select(`
          id,
          plan_id,
          status,
          subscription_plans (
            type
          )
        `)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (subscription && subscription.subscription_plans) {
        const plans = subscription.subscription_plans as { type: string } | { type: string }[];
        const planType = Array.isArray(plans) ? plans[0]?.type : plans.type;
        
        setCurrentSubscription({
          plan_id: subscription.plan_id,
          plan_type: planType,
        });
      }
    } catch (error) {
      console.error("Error fetching current subscription:", error);
    }
  }, []);

  const fetchPlan = useCallback(async () => {
    if (!planType) {
      navigate("/planos");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("type", planType as "bronze" | "prata" | "ouro" | "diamante" | "bronze-coletivo" | "prata-coletivo" | "ouro-coletivo" | "diamante-coletivo")
        .single();

      if (error || !data) {
        navigate("/planos");
        return;
      }

      const formattedPlan = {
        ...data,
        features: Array.isArray(data.features)
          ? data.features
          : JSON.parse(data.features as string || "[]"),
      };

      setPlan(formattedPlan);
    } catch (error) {
      console.error("Error fetching plan:", error);
      navigate("/planos");
    } finally {
      setLoading(false);
    }
  }, [planType, navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session) {
          navigate(`/auth?plan=${planType}`);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate(`/auth?plan=${planType}`);
      } else if (session.user) {
        fetchProfile(session.user.id);
        fetchCurrentSubscription(session.user.id);
        fetchPlan();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, planType, fetchProfile, fetchCurrentSubscription, fetchPlan]);

  // Verificar se o usuário está tentando assinar o mesmo plano
  useEffect(() => {
    if (currentSubscription && plan && currentSubscription.plan_type === plan.type) {
      toast({
        title: "Plano já contratado",
        description: `Você já possui o plano ${plan.name} ativo. Escolha outro plano para fazer upgrade ou downgrade.`,
        variant: "destructive",
      });
      navigate("/planos");
    }
  }, [currentSubscription, plan, navigate, toast]);

  const handleSuccess = async (recurrentPaymentId: string) => {
    // Salvar a assinatura no banco de dados
    if (user && plan) {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      // Verificar se já existe uma assinatura ativa para o usuário
      const { data: existingSubscription } = await supabase
        .from("user_subscriptions")
        .select("id, plan_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (existingSubscription) {
        // Verificar se não é o mesmo plano (validação adicional)
        if (existingSubscription.plan_id === plan.id) {
          toast({
            title: "Erro",
            description: "Você já possui este plano ativo.",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }

        // Atualizar a assinatura existente (upgrade/downgrade)
        const { error } = await supabase
          .from("user_subscriptions")
          .update({
            plan_id: plan.id,
            started_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            billing_cycle: "monthly",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSubscription.id);

        if (error) {
          console.error("Error updating subscription:", error);
          toast({
            title: "Erro",
            description: "Não foi possível atualizar sua assinatura.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Plano atualizado!",
          description: `Seu plano foi alterado para ${plan.name} com sucesso.`,
        });
      } else {
        // Criar nova assinatura
        const { error } = await supabase
          .from("user_subscriptions")
          .insert({
            user_id: user.id,
            plan_id: plan.id,
            status: "active",
            started_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            billing_cycle: "monthly",
          });

        if (error) {
          console.error("Error creating subscription:", error);
          toast({
            title: "Erro",
            description: "Não foi possível criar sua assinatura.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Assinatura ativada!",
          description: `Bem-vindo ao plano ${plan.name}!`,
        });
      }

      // Redirecionar para o dashboard após sucesso
      navigate("/dashboard");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Plano não encontrado</p>
          <Button onClick={() => navigate("/planos")}>Ver planos disponíveis</Button>
        </div>
      </div>
    );
  }

  const customer: CustomerData = {
    name: profile?.full_name || user?.user_metadata?.full_name || "",
    email: profile?.email || user?.email || "",
    cpf: profile?.cpf || user?.user_metadata?.cpf,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/planos")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar aos planos
          </Button>

          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <span className="font-heading font-semibold">Checkout Seguro</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-2">
              Assinar Plano {plan.name}
            </h1>
            <p className="text-muted-foreground">
              Complete seu pagamento para ativar sua assinatura
            </p>
          </div>

          <SubscriptionCheckout
            plan={{
              id: plan.id,
              name: plan.name,
              priceMonthly: plan.price_monthly,
              priceYearly: plan.price_yearly || undefined,
              features: plan.features,
              maxDependents: plan.max_dependents,
              specialistConsultationsPerYear: plan.specialist_consultations_per_year,
              includesCheckup: plan.includes_checkup,
            }}
            customer={customer}
            onSuccess={handleSuccess}
            onCancel={() => navigate("/planos")}
          />
        </div>
      </main>
    </div>
  );
};

export default CheckoutSubscription;
