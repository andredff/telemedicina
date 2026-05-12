import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Video, Loader2, Stethoscope, CheckCircle, XCircle, CreditCard, Plus, Minus } from "lucide-react";
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
  const [quantity, setQuantity] = useState(1);
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    paymentId?: string;
    message: string;
    redirectPath?: string;
  } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // Determina o tipo de consulta baseado no parâmetro da URL
  const consultationType = typeParam && CONSULTATION_TYPES[typeParam] 
    ? CONSULTATION_TYPES[typeParam] 
    : CONSULTATION_TYPES.clinico_geral;

  const totalPrice = consultationType.price * quantity;

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
          // Guarda o tipo de consulta para redirecionar após login
          navigate(`/auth?redirect=/checkout/consultation&type=${typeParam || 'clinico_geral'}`);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate(`/auth?redirect=/checkout/consultation&type=${typeParam || 'clinico_geral'}`);
      } else if (session.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, fetchProfile, typeParam]);

  // Redireciona se o tipo não for válido
  useEffect(() => {
    if (!loading && !typeParam) {
      navigate("/teleconsultas");
    }
  }, [loading, typeParam, navigate]);

  // Countdown de redirecionamento após pagamento bem-sucedido
  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown <= 0) {
      if (paymentResult?.redirectPath) navigate(paymentResult.redirectPath);
      return;
    }
    const timer = setTimeout(() => setRedirectCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [redirectCountdown, paymentResult, navigate]);

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
        toCents(totalPrice),
        parseInt(installments)
      );

      if (result.success) {
        // Salva os créditos no banco de dados (um por quantidade)
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 6); // Crédito válido por 6 meses

        // Cria array de créditos para inserir
        const creditsToInsert = Array.from({ length: quantity }, () => ({
          user_id: user.id,
          type: consultationType.id,
          amount: consultationType.price,
          payment_id: result.paymentId,
          status: "available",
          expires_at: expiresAt.toISOString(),
        }));

        // Usa any porque a tabela consultation_credits ainda não está nos tipos gerados
        const { data: creditData, error: creditError } = await (supabase as any)
          .from("consultation_credits")
          .insert(creditsToInsert)
          .select();

        if (creditError) {
          logger.error("Error saving consultation credits:", creditError);
          // Continua mesmo com erro - o pagamento já foi processado
        }

        const creditsCreated = creditData?.length || quantity;
        const redirectPath = consultationType.id === "especialista"
          ? "/especialistas"
          : "/teleconsultas";

        setPaymentResult({
          success: true,
          paymentId: result.paymentId,
          message: `Pagamento aprovado! ${creditsCreated} consulta${creditsCreated > 1 ? 's' : ''} adicionada${creditsCreated > 1 ? 's' : ''} à sua conta.`,
          redirectPath,
        });
        setRedirectCountdown(5);
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

        <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="max-w-md mx-auto">
            <Card className={paymentResult.success ? "border-green-200" : "border-red-200"}>
              <CardContent className="pt-6 px-5 sm:px-6 pb-6">
                <div className="text-center">
                  {paymentResult.success ? (
                    <CheckCircle className="h-14 w-14 sm:h-16 sm:w-16 text-green-500 mx-auto mb-4" />
                  ) : (
                    <XCircle className="h-14 w-14 sm:h-16 sm:w-16 text-red-500 mx-auto mb-4" />
                  )}
                  <h2 className="text-lg sm:text-xl font-heading font-bold mb-2">
                    {paymentResult.success ? "Pagamento Aprovado!" : "Pagamento Não Aprovado"}
                  </h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-6">
                    {paymentResult.message}
                  </p>
                  {paymentResult.success && paymentResult.redirectPath ? (
                    <div className="space-y-3">
                      <Button
                        className="w-full"
                        onClick={() => navigate(paymentResult.redirectPath!)}
                      >
                        Ir para Teleconsultas
                      </Button>
                      {redirectCountdown !== null && redirectCountdown > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Redirecionando em {redirectCountdown}s...
                        </p>
                      )}
                    </div>
                  ) : !paymentResult.success && (
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

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <BackLink to="/teleconsultas" label="Voltar às Teleconsultas" />

        <div className="mx-auto max-w-5xl">
          <div className="mb-6 sm:mb-10 text-center px-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-primary mb-2 tracking-tight">
              Comprar Consultas Avulsas
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Adquira consultas e use quando precisar
            </p>
          </div>

          <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1fr_380px] lg:gap-8 items-start">
            {/* Coluna: formulário de pagamento */}
            <div className="order-2 lg:order-1">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <CreditCard className="h-5 w-5 shrink-0" />
                    Pagamento com Cartão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
                  {/* Parcelas */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Parcelas</label>
                    <Select
                      value={installments}
                      onValueChange={setInstallments}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">
                          1x de R$ {totalPrice.toFixed(2).replace(".", ",")} (sem juros)
                        </SelectItem>
                        <SelectItem value="2">
                          2x de R$ {(totalPrice / 2).toFixed(2).replace(".", ",")} (sem juros)
                        </SelectItem>
                        <SelectItem value="3">
                          3x de R$ {(totalPrice / 3).toFixed(2).replace(".", ",")} (sem juros)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Formulário do cartão */}
                  <CreditCardForm
                    onSubmit={handleCreditCardSubmit}
                    isLoading={isProcessing}
                    submitLabel="Confirmar Pagamento"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Coluna: resumo (sticky no desktop) */}
            <div className="order-1 lg:order-2 lg:sticky lg:top-24">
              <Card className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {consultationType.id === "clinico_geral" ? (
                        <Stethoscope className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      ) : (
                        <Video className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base sm:text-lg leading-snug break-words">
                        {consultationType.name}
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm mt-1">
                        {consultationType.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-0">
                  {/* Preço unitário */}
                  <div className="flex justify-between items-center py-3 text-sm sm:text-base">
                    <span className="text-muted-foreground">Preço unitário</span>
                    <span className="font-medium">
                      R$ {consultationType.price.toFixed(2).replace(".", ",")}
                    </span>
                  </div>

                  {/* Quantidade */}
                  <div className="flex justify-between items-center py-3 border-t gap-3">
                    <span className="text-sm sm:text-base text-muted-foreground">Quantidade</span>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        aria-label="Diminuir quantidade"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-6 sm:w-8 text-center font-bold text-base sm:text-lg tabular-nums">
                        {quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                        onClick={() => setQuantity(Math.min(10, quantity + 1))}
                        disabled={quantity >= 10}
                        aria-label="Aumentar quantidade"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>

                {/* Total — rodapé destacado, sem hack de negative margin */}
                <div className="flex justify-between items-center gap-3 px-4 sm:px-6 py-4 border-t bg-muted/60">
                  <span className="text-sm sm:text-base font-medium">Total</span>
                  <span className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                    R$ {totalPrice.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CheckoutConsultation;
