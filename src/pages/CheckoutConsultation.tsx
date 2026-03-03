import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Video, Loader2, Stethoscope, CheckCircle, XCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { CreditCardForm } from "@/components/checkout/CreditCardForm";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  processMedicationPayment,
  toCents,
  type CardData,
  type CustomerData,
} from "@/services/paymentService";

// Tipos de consulta avulsa
const CONSULTATION_TYPES = {
  clinico_geral: {
    id: "clinico_geral",
    name: "Consulta Avulsa - Clínico Geral",
    description: "Consulta pontual com médico clínico geral, sem compromisso.",
    price: 59.90,
  },
  especialista: {
    id: "especialista",
    name: "Consulta Avulsa - Especialista",
    description: "Consulta pontual com médico especialista.",
    price: 119.90,
  },
} as const;

type ConsultationType = keyof typeof CONSULTATION_TYPES;

const CheckoutConsultation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get("type") as ConsultationType | null;

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; email: string; cpf?: string } | null>(null);
  const [installments, setInstallments] = useState("1");
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    paymentId?: string;
    message: string;
  } | null>(null);

  // Determina o tipo de consulta baseado no parâmetro da URL
  const consultationType = typeParam && CONSULTATION_TYPES[typeParam] 
    ? CONSULTATION_TYPES[typeParam] 
    : CONSULTATION_TYPES.clinico_geral;

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        const userData = await supabase.auth.getUser();
        const cpf = userData.data.user?.user_metadata?.cpf;
        setProfile({ ...data, cpf });
      }
    } catch (error) {
      logger.error("Error fetching profile:", error);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
      } else if (session.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, fetchProfile]);

  // Redireciona se o tipo não for válido
  useEffect(() => {
    if (!loading && !typeParam) {
      navigate("/teleconsultas");
    }
  }, [loading, typeParam, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleCreditCardSubmit = async (cardData: CardData) => {
    if (!user || !profile) {
      toast.error("Dados do usuário não disponíveis");
      return;
    }

    setIsProcessing(true);

    try {
      const customer: CustomerData = {
        name: profile.full_name || user.user_metadata?.full_name || "",
        email: profile.email || user.email || "",
        cpf: profile.cpf || user.user_metadata?.cpf,
      };

      const orderId = `CONS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const result = await processMedicationPayment(
        orderId,
        customer,
        cardData,
        toCents(consultationType.price),
        parseInt(installments)
      );

      if (result.success) {
        // Salva o crédito no banco de dados
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 6); // Crédito válido por 6 meses

        // Usa any porque a tabela consultation_credits ainda não está nos tipos gerados
        const { data: creditData, error: creditError } = await (supabase as any)
          .from("consultation_credits")
          .insert({
            user_id: user.id,
            type: consultationType.id,
            amount: consultationType.price,
            payment_id: result.paymentId,
            status: "available",
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (creditError) {
          logger.error("Error saving consultation credit:", creditError);
          // Continua mesmo com erro - o pagamento já foi processado
        }

        setPaymentResult({
          success: true,
          paymentId: result.paymentId,
          message: "Pagamento aprovado! Você será redirecionado para iniciar sua consulta.",
        });

        // Redireciona para a página correta após 3 segundos com o ID do crédito
        const creditId = creditData?.id;
        const redirectPath = consultationType.id === "especialista" 
          ? "/especialistas" 
          : "/teleconsultas";
        setTimeout(() => {
          navigate(`${redirectPath}?consultation_credit=${creditId || consultationType.id}`);
        }, 3000);
      } else {
        setPaymentResult({
          success: false,
          message: result.message || "Pagamento negado",
        });
      }
    } catch (error) {
      logger.error("Payment error:", error);
      setPaymentResult({
        success: false,
        message: error instanceof Error ? error.message : "Erro ao processar pagamento",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Resultado do pagamento
  if (paymentResult) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAuthenticated onLogout={handleLogout} />

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card className={paymentResult.success ? "border-green-200" : "border-red-200"}>
              <CardContent className="pt-6">
                <div className="text-center">
                  {paymentResult.success ? (
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  ) : (
                    <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                  )}
                  <h2 className="text-xl font-heading font-bold mb-2">
                    {paymentResult.success ? "Pagamento Aprovado!" : "Pagamento Não Aprovado"}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {paymentResult.message}
                  </p>
                  {!paymentResult.success && (
                    <Button onClick={() => setPaymentResult(null)} className="w-full">
                      Tentar novamente
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8">
        <BackLink to="/teleconsultas" />
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-2">
              Comprar Consulta Avulsa
            </h1>
            <p className="text-muted-foreground">
              Pague e inicie sua consulta imediatamente
            </p>
          </div>

          <div className="grid gap-6">
            {/* Resumo da consulta */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    {consultationType.id === "clinico_geral" ? (
                      <Stethoscope className="h-6 w-6 text-primary" />
                    ) : (
                      <Video className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{consultationType.name}</CardTitle>
                    <CardDescription>{consultationType.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center py-3 border-t">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-2xl font-bold text-foreground">
                    R$ {consultationType.price.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Formulário de pagamento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" />
                  Pagamento com Cartão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Parcelas */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Parcelas</label>
                  <Select
                    value={installments}
                    onValueChange={setInstallments}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">
                        1x de R$ {consultationType.price.toFixed(2).replace(".", ",")} (sem juros)
                      </SelectItem>
                      <SelectItem value="2">
                        2x de R$ {(consultationType.price / 2).toFixed(2).replace(".", ",")} (sem juros)
                      </SelectItem>
                      <SelectItem value="3">
                        3x de R$ {(consultationType.price / 3).toFixed(2).replace(".", ",")} (sem juros)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Formulário do cartão */}
                <CreditCardForm
                  onSubmit={handleCreditCardSubmit}
                  isLoading={isProcessing}
                  submitLabel="Pagar e Iniciar Consulta"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CheckoutConsultation;
