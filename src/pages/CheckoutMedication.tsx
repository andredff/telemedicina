import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { MedicationCheckout } from "@/components/checkout";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { User, Session } from "@supabase/supabase-js";
import { useCart } from "@/hooks/useCart";
import { usePaidPrescriptions } from "@/hooks/usePaidPrescriptions";
import type { CustomerData } from "@/services/paymentService";
import type { CatalogCartItem } from "@/types/prescription";

const CheckoutMedication = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const cart = useCart();
  const cartItems = cart.items;
  const catalogItems = cart.catalogItems;
  const { markAsPaid } = usePaidPrescriptions();
  const [paymentDone, setPaymentDone] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; email: string; cpf?: string; phone?: string } | null>(null);

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
  }, [navigate]);

  useEffect(() => {
    if (!cart.loading && cartItems.length === 0 && catalogItems.length === 0 && !paymentDone) {
      navigate("/cart");
    }
  }, [cart.loading, cartItems.length, catalogItems.length, paymentDone, navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", userId)
        .maybeSingle() as { data: { full_name: string; email: string; phone?: string | null } | null };

      if (data) {
        const userData = await supabase.auth.getUser();
        const cpf = userData.data.user?.user_metadata?.cpf;
        const phone = data.phone || userData.data.user?.user_metadata?.phone;
        setProfile({ full_name: data.full_name, email: data.email, cpf, phone });
      }
    } catch (error) {
      logger.error("Error fetching profile:", error);
    }
  };

  const handleSuccess = (_paymentId: string) => {
    setPaymentDone(true);
    cart.clearCart();
    cart.clearCatalogItems();
  };

  if (loading || cart.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (cartItems.length === 0 && catalogItems.length === 0 && !paymentDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-heading font-semibold mb-2">Carrinho vazio</h2>
          <p className="text-muted-foreground mb-6">
            Adicione medicamentos dos seus receituários
          </p>
          <Button onClick={() => navigate("/dashboard")}>Ver receituários</Button>
        </div>
      </div>
    );
  }

  const customer: CustomerData = {
    name: profile?.full_name || user?.user_metadata?.full_name || "",
    email: profile?.email || user?.email || "",
    cpf: profile?.cpf || user?.user_metadata?.cpf,
    phone: profile?.phone || user?.user_metadata?.phone,
  };

  // Gate de CPF: a Cielo exige CPF do pagador em pagamentos PIX (BACEN).
  // Usuários antigos sem CPF cadastrado precisam completar o perfil antes.
  if (!customer.cpf) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAuthenticated title="Checkout" />
        <main className="container mx-auto px-4 py-8">
          <BackLink to="/cart" label="Voltar ao Carrinho" />
          <div className="max-w-md mx-auto mt-8 p-6 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-amber-600" />
            <h2 className="text-xl font-heading font-semibold mb-2 text-amber-900">
              Complete seu cadastro
            </h2>
            <p className="text-sm text-amber-800 mb-5">
              Precisamos do seu CPF para processar pagamentos com segurança.
              O CPF é obrigatório por exigência do Banco Central.
            </p>
            <Button onClick={() => navigate("/perfil")} className="w-full">
              Completar cadastro
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        isAuthenticated
        title="Checkout"
      />

      <main className="container mx-auto px-4 py-8">
        <BackLink to="/cart" label="Voltar ao Carrinho" />
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-2">
              Finalizar Compra
            </h1>
            <p className="text-muted-foreground">
              Complete seu pagamento para receber seus medicamentos
            </p>
          </div>

          <MedicationCheckout
            items={cartItems}
            catalogItems={catalogItems as CatalogCartItem[]}
            customer={customer}
            onSuccess={handleSuccess}
            onPrescriptionsPaid={markAsPaid}
            onCancel={() => navigate("/cart")}
          />
        </div>
      </main>
    </div>
  );
};

export default CheckoutMedication;
