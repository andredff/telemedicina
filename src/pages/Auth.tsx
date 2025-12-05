import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Heart, ArrowLeft, Eye, EyeOff, Mail, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { z } from "zod";

// Validation schemas
const loginSchema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }).max(255),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }).max(100),
  email: z.string().trim().email({ message: "Email inválido" }).max(255),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }),
  cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { message: "CPF inválido" }),
  phone: z.string().min(10, { message: "Telefone inválido" }).max(20),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }).max(255),
});

// Mask formatting functions
const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [cpfValue, setCpfValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");

  const selectedPlan = searchParams.get("plan");
  const consultationType = searchParams.get("type");
  const tabParam = searchParams.get("tab");

  useEffect(() => {
    if (tabParam === "forgot") {
      setShowForgotPassword(true);
    }
  }, [tabParam]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Redirect to dashboard if logged in
        if (session?.user) {
          navigate("/dashboard");
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("forgot-email") as string;

    // Validate
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      toast({
        title: "Dados inválidos",
        description: result.error.issues[0].message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          title: "Erro ao enviar email",
          description: error.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setForgotPasswordSent(true);
      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
    } catch (error) {
      toast({
        title: "Erro ao enviar email",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Validate input
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      toast({
        title: "Dados inválidos",
        description: result.error.issues[0].message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: result.data.email,
        password: result.data.password,
      });

      if (error) {
        let errorMessage = "Verifique suas credenciais e tente novamente.";
        
        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "Email ou senha incorretos.";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Confirme seu email antes de fazer login.";
        }
        
        toast({
          title: "Erro ao fazer login",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo à Novità",
      });
      
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Erro ao fazer login",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const cpf = formData.get("cpf") as string;
    const phone = formData.get("phone") as string;

    // Validate input
    const result = signupSchema.safeParse({ name, email, password, cpf, phone });
    if (!result.success) {
      toast({
        title: "Dados inválidos",
        description: result.error.issues[0].message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: result.data.name,
            cpf: result.data.cpf,
            phone: result.data.phone,
          }
        }
      });

      if (error) {
        let errorMessage = "Não foi possível criar sua conta.";
        
        if (error.message.includes("already registered")) {
          errorMessage = "Este email já está cadastrado. Tente fazer login.";
        } else if (error.message.includes("valid email")) {
          errorMessage = "Insira um email válido.";
        }
        
        toast({
          title: "Erro no cadastro",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Cadastro realizado com sucesso!",
        description: "Bem-vindo à Novità!",
      });
      
      // Auto-login after signup (since auto-confirm is enabled)
      if (data.session) {
        navigate("/dashboard");
      }
      
      setIsLoading(false);
    } catch (error) {
      toast({
        title: "Erro no cadastro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Hero image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30" />
        <img 
          src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80" 
          alt="Profissional de saúde" 
          className="object-cover w-full h-full"
        />
        <div className="absolute bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-foreground/95 to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="gradient-hero rounded-xl p-3">
              <Heart className="h-8 w-8 text-primary-foreground" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold text-background">Novità</h1>
              <p className="text-sm text-primary">Home Care & Telemedicina</p>
            </div>
          </div>
          <h2 className="text-3xl font-heading font-bold text-background mb-2">
            Sua saúde ao alcance de um clique
          </h2>
          <p className="text-background/80 text-lg">
            Consultas online 24h, receitas digitais e medicamentos entregues em casa.
          </p>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex flex-col">
        {/* Back button */}
        <div className="p-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao início
            </Link>
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
              <div className="gradient-hero rounded-xl p-2.5">
                <Heart className="h-6 w-6 text-primary-foreground" fill="currentColor" />
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground">Novità</h1>
                <p className="text-xs text-primary">Home Care & Telemedicina</p>
              </div>
            </div>

            {/* Plan info if selected */}
            {selectedPlan && (
              <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-sm text-muted-foreground">Plano selecionado:</p>
                <p className="font-heading font-semibold text-primary capitalize">{selectedPlan}</p>
              </div>
            )}

            {consultationType === "avulsa" && (
              <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/20">
                <p className="text-sm text-muted-foreground">Tipo de atendimento:</p>
                <p className="font-heading font-semibold text-accent">Consulta Avulsa - R$ 59,90</p>
              </div>
            )}

            {/* Forgot Password Form */}
            {showForgotPassword ? (
              forgotPasswordSent ? (
                <Card className="border-border/50 shadow-card">
                  <CardHeader className="text-center">
                    <div className="mx-auto mb-4 bg-green-100 rounded-full p-4 w-fit">
                      <CheckCircle className="h-12 w-12 text-green-600" />
                    </div>
                    <CardTitle className="font-heading text-green-600">Email enviado!</CardTitle>
                    <CardDescription>
                      Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setForgotPasswordSent(false);
                      }}
                    >
                      Voltar ao login
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border/50 shadow-card">
                  <CardHeader>
                    <CardTitle className="font-heading">Recuperar senha</CardTitle>
                    <CardDescription>
                      Digite seu email para receber o link de recuperação
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="forgot-email"
                            name="forgot-email"
                            type="email"
                            placeholder="seu@email.com.br"
                            required
                            autoComplete="email"
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full gradient-hero text-primary-foreground"
                        disabled={isLoading}
                      >
                        {isLoading ? "Enviando..." : "Enviar link de recuperação"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(false)}
                        className="w-full text-sm text-muted-foreground hover:text-foreground"
                      >
                        Voltar ao login
                      </button>
                    </form>
                  </CardContent>
                </Card>
              )
            ) : (
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Cadastro</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Card className="border-border/50 shadow-card">
                  <CardHeader>
                    <CardTitle className="font-heading">Acesse sua conta</CardTitle>
                    <CardDescription>
                      Entre para acessar suas consultas e receitas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="seu@email.com.br"
                          required
                          autoComplete="email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Senha</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full gradient-hero text-primary-foreground" 
                        disabled={isLoading}
                      >
                        {isLoading ? "Entrando..." : "Entrar"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="w-full text-sm text-primary hover:underline"
                      >
                        Esqueci minha senha
                      </button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="signup">
                <Card className="border-border/50 shadow-card">
                  <CardHeader>
                    <CardTitle className="font-heading">Criar conta</CardTitle>
                    <CardDescription>
                      Cadastre-se para acessar a telemedicina Novità
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome completo</Label>
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          placeholder="Seu nome completo"
                          required
                          autoComplete="name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cpf">CPF</Label>
                        <Input
                          id="cpf"
                          name="cpf"
                          type="text"
                          placeholder="000.000.000-00"
                          required
                          value={cpfValue}
                          onChange={(e) => setCpfValue(formatCPF(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="(00) 00000-0000"
                          required
                          value={phoneValue}
                          onChange={(e) => setPhoneValue(formatPhone(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          name="email"
                          type="email"
                          placeholder="seu@email.com.br"
                          required
                          autoComplete="email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Senha</Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Mínimo 6 caracteres"
                            required
                            autoComplete="new-password"
                            minLength={6}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full gradient-hero text-primary-foreground" 
                        disabled={isLoading}
                      >
                        {isLoading ? "Cadastrando..." : "Criar conta"}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Ao criar sua conta, você concorda com nossos{" "}
                        <Link to="/termos" className="text-primary hover:underline">
                          Termos de Uso
                        </Link>{" "}
                        e{" "}
                        <Link to="/privacidade" className="text-primary hover:underline">
                          Política de Privacidade
                        </Link>
                        .
                      </p>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;