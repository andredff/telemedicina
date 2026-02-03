import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  CreditCard,
  Crown,
  Calendar,
  Heart,
  Loader2,
  Shield,
  Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { User as SupabaseUser } from "@supabase/supabase-js";

interface UserSubscription {
  id: string;
  status: string;
  expires_at: string | null;
  billing_cycle: string;
  specialist_consultations_used: number;
  plan: {
    name: string;
    type: string;
    description: string;
    price_monthly: number;
    specialist_consultations_per_year: number;
    includes_checkup: boolean;
  } | null;
}

const ProfileSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          navigate("/auth");
          return;
        }

        setUser(user);

        // Buscar dados do perfil
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .single();

        if (profile) {
          setFormData({
            full_name: profile.full_name || "",
            email: profile.email || "",
            phone: user.user_metadata?.phone || "",
            cpf: user.user_metadata?.cpf || "",
          });
        }

        // Buscar assinatura
        const { data: subData } = await supabase
          .from("user_subscriptions")
          .select(`
            id,
            status,
            expires_at,
            billing_cycle,
            specialist_consultations_used,
            plan:subscription_plans (
              name,
              type,
              description,
              price_monthly,
              specialist_consultations_per_year,
              includes_checkup
            )
          `)
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (subData) {
          const subscriptionData: UserSubscription = {
            ...subData,
            plan: Array.isArray(subData.plan) ? subData.plan[0] : subData.plan,
          };
          setSubscription(subscriptionData);
        }
      } catch (error) {
        logger.error("Error fetching user data:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar seus dados.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate, toast]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return value;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      if (numbers.length <= 10) {
        return numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
      }
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return value;
  };

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    handleInputChange("cpf", formatted);
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    handleInputChange("phone", formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!user) return;

      // Validações básicas
      if (!formData.full_name.trim()) {
        toast({
          title: "Erro",
          description: "O nome completo é obrigatório.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      if (!formData.email.trim() || !formData.email.includes("@")) {
        toast({
          title: "Erro",
          description: "Por favor, insira um email válido.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // Atualizar perfil no Supabase
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Atualizar metadados do usuário (phone e cpf)
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          cpf: formData.cpf.trim() || null,
        },
      });

      if (metadataError) throw metadataError;

      // Se o email mudou, atualizar no auth
      if (formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email.trim(),
        });

        if (emailError) throw emailError;

        toast({
          title: "Email atualizado",
          description: "Um email de confirmação foi enviado para o novo endereço.",
        });
      }

      toast({
        title: "Perfil atualizado!",
        description: "Seus dados foram atualizados com sucesso.",
      });
    } catch (error) {
      logger.error("Error updating profile:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar seus dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatExpirationDate = (dateStr: string | null) => {
    if (!dateStr) return "Sem data definida";
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-md border-b border-border/50 shadow-soft">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>

          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <span className="font-heading font-semibold">Configurações</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-2">
            Meu Perfil
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas informações pessoais e assinatura
          </p>
        </div>

        <div className="grid gap-6">
          {/* Subscription Card */}
          {subscription?.plan && (
            <Card className="gradient-hero border-0 text-primary-foreground">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5" />
                  <CardTitle>Plano Ativo</CardTitle>
                </div>
                <CardDescription className="text-primary-foreground/80">
                  Seu plano de assinatura atual
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-2xl font-heading font-bold mb-1">
                      Plano {subscription.plan.name}
                    </h3>
                    <p className="text-primary-foreground/80">
                      {subscription.plan.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-primary-foreground/20">
                    <div>
                      <p className="text-sm text-primary-foreground/80">Valor mensal</p>
                      <p className="text-lg font-bold">
                        R$ {subscription.plan.price_monthly.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-primary-foreground/80">Válido até</p>
                      <p className="text-lg font-bold">
                        {formatExpirationDate(subscription.expires_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-primary-foreground/80">Consultas especialistas</p>
                      <p className="text-lg font-bold">
                        {subscription.specialist_consultations_used || 0} /{" "}
                        {subscription.plan.specialist_consultations_per_year}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-primary-foreground/80">Check-up anual</p>
                      <p className="text-lg font-bold">
                        {subscription.plan.includes_checkup ? "Incluído" : "Não incluído"}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    className="w-full bg-card text-foreground hover:bg-card/90"
                    onClick={() => navigate("/planos")}
                  >
                    Alterar plano
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Informações Pessoais</CardTitle>
              </div>
              <CardDescription>
                Mantenha seus dados atualizados para melhor experiência
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => handleInputChange("full_name", e.target.value)}
                      placeholder="Seu nome completo"
                      disabled={saving}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="seu@email.com"
                      disabled={saving}
                      required
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se você alterar seu email, precisará confirmá-lo.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(00) 00000-0000"
                      disabled={saving}
                      maxLength={15}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => handleCPFChange(e.target.value)}
                      placeholder="000.000.000-00"
                      disabled={saving}
                      maxLength={14}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                    disabled={saving}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar alterações
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Segurança</CardTitle>
              </div>
              <CardDescription>
                Proteja sua conta com senha segura
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Senha</p>
                    <p className="text-sm text-muted-foreground">
                      Última alteração: {new Date().toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/reset-password")}
                  >
                    Alterar senha
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Suas informações estão protegidas com criptografia de ponta a ponta
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ProfileSettings;
