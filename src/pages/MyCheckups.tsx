import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HeartPulse, Info, Building2, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";
import { ALL_PLANS, getCheckupsForBilling } from "@/data/plansData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscription {
  id: string;
  billing_cycle: string | null;
  plan: {
    name: string;
    type: string;
  } | null;
}

interface CheckupUsage {
  id: string;
  performed_at: string;
  lab_name: string;
  performed_by_name: string | null;
}

const MyCheckups = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [used, setUsed] = useState(0);
  const [history, setHistory] = useState<CheckupUsage[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }

        const { data: sub, error: subErr } = await supabase
          .from("user_subscriptions")
          .select(`
            id,
            billing_cycle,
            plan:subscription_plans ( name, type )
          `)
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (subErr) logger.error("Error loading subscription:", subErr);
        setSubscription(sub as Subscription | null);

        // Histórico de check-ups — tabela ainda não criada, então é resiliente
        try {
          const { data: usages } = await supabase
            .from("checkup_usages" as never)
            .select("id, performed_at, lab_name, performed_by_name")
            .eq("user_id", user.id)
            .order("performed_at", { ascending: false });
          if (usages) {
            setHistory(usages as CheckupUsage[]);
            setUsed(usages.length);
          }
        } catch {
          // Tabela ainda não existe — tudo bem, mostramos saldo cheio
        }
      } catch (e) {
        logger.error("Error loading checkups:", e);
        toast({
          title: "Erro",
          description: "Não foi possível carregar seus check-ups.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate, toast]);

  const planData = subscription?.plan
    ? ALL_PLANS.find((p) => p.type === subscription.plan!.type)
    : null;
  const billing = (subscription?.billing_cycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly";
  const total = planData ? getCheckupsForBilling(planData, billing) : 0;
  const available = Math.max(0, total - used);

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated />
      <main className="page-container">
        <BackLink />

        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 flex items-center justify-center">
            <HeartPulse className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-primary">
              Meus check-ups
            </h1>
            <p className="text-muted-foreground text-sm">
              Acompanhe seu saldo anual e histórico de check-ups realizados
            </p>
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : !subscription ? (
          <Card>
            <CardHeader>
              <CardTitle>Você ainda não tem um plano</CardTitle>
              <CardDescription>
                Assine um plano para ter direito a check-ups anuais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/planos")}>Ver planos</Button>
            </CardContent>
          </Card>
        ) : total === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Seu plano não inclui check-ups</CardTitle>
              <CardDescription>
                O plano <strong>{subscription.plan?.name}</strong> não oferece check-ups anuais.
                Faça upgrade para Ouro ou Diamante para incluir esse benefício.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/meu-plano")}>Ver opções de upgrade</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-rose-500/20">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Saldo disponível neste ciclo
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-foreground">{available}</span>
                      <span className="text-lg text-muted-foreground">de {total}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Plano <strong>{subscription.plan?.name}</strong> ·{" "}
                      {billing === "yearly" ? "Anual" : "Mensal"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="self-start sm:self-auto">
                    {used} {used === 1 ? "realizado" : "realizados"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardContent className="p-5 flex gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Como utilizar</p>
                  <p>
                    Apresente seu CPF no laboratório parceiro. O atendente registra o uso do
                    check-up no sistema, e o saldo é atualizado automaticamente nesta página.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="mt-8">
              <p className="section-title">Histórico</p>
              {history.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-50" />
                    Nenhum check-up realizado ainda.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <Card key={h.id}>
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{h.lab_name}</p>
                            {h.performed_by_name && (
                              <p className="text-xs text-muted-foreground">
                                Atendente: {h.performed_by_name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(h.performed_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default MyCheckups;
