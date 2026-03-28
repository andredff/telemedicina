import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Heart, ArrowLeft, Eye, EyeOff, CheckCircle, ShieldCheck, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// ── Password strength rules ────────────────────────────────────────────────
const PASSWORD_RULES = [
  { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "Número", test: (p: string) => /\d/.test(p) },
];

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, { message: "Senha deve ter pelo menos 8 caracteres" })
    .regex(/[A-Z]/, { message: "Senha deve conter pelo menos uma letra maiúscula" })
    .regex(/[a-z]/, { message: "Senha deve conter pelo menos uma letra minúscula" })
    .regex(/\d/, { message: "Senha deve conter pelo menos um número" }),
  confirmPassword: z.string().min(1, { message: "Confirme a nova senha" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function getServerUrl() {
  if (import.meta.env.DEV) return "";
  return import.meta.env.VITE_LOCAL_SERVER_URL || "";
}

async function notifyPasswordChanged(email: string, name: string) {
  try {
    const baseUrl = getServerUrl();
    await fetch(`${baseUrl}/api/notifications/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "SenhaAlterada",
        data: {
          email,
          nome: name,
          dataHora: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        },
      }),
    });
  } catch {
    // Fire-and-forget — don't block the user
  }
}

// ── Password strength indicator ──────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const strength = password.length === 0 ? -1 : passed;

  const strengthLabel =
    strength <= 1 ? "Fraca" : strength === 2 ? "Razoável" : strength === 3 ? "Boa" : "Forte";
  const strengthColor =
    strength <= 1
      ? "bg-red-500"
      : strength === 2
        ? "bg-amber-500"
        : strength === 3
          ? "bg-blue-500"
          : "bg-green-500";

  if (password.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < strength ? strengthColor : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${strength >= 3 ? "text-green-600" : strength >= 2 ? "text-amber-600" : "text-red-600"}`}>
          {strengthLabel}
        </span>
      </div>

      {/* Rules checklist */}
      <ul className="space-y-1">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.label} className="flex items-center gap-1.5 text-xs">
              {ok ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground/50" />
              )}
              <span className={ok ? "text-green-700" : "text-muted-foreground"}>
                {rule.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  const allRulesPassed = useMemo(
    () => PASSWORD_RULES.every((r) => r.test(password)),
    [password]
  );

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setIsValidSession(true);
        setUserEmail(session.user.email || "");
        setUserName(session.user.user_metadata?.full_name || "");
      }
      setIsChecking(false);
    };

    // Listen for auth events — PASSWORD_RECOVERY is triggered by recovery link
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsValidSession(true);
          setIsRecoveryFlow(true);
          setIsChecking(false);
          if (session) {
            setUserEmail(session.user.email || "");
            setUserName(session.user.user_metadata?.full_name || "");
          }
        }
      }
    );

    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const passwordValue = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    const result = passwordSchema.safeParse({ password: passwordValue, confirmPassword });
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
      const { error } = await supabase.auth.updateUser({
        password: result.data.password,
      });

      if (error) {
        // Handle specific Supabase errors
        let description = error.message;
        if (error.message.includes("same_password")) {
          description = "A nova senha deve ser diferente da senha atual.";
        } else if (error.message.includes("session_not_found") || error.message.includes("not authenticated")) {
          description = "Sessão expirada. Solicite um novo link de recuperação.";
        }

        toast({
          title: "Erro ao redefinir senha",
          description,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Dispatch "SenhaAlterada" notification (fire-and-forget)
      if (userEmail) {
        notifyPasswordChanged(userEmail, userName || "Cliente");
      }

      setIsSuccess(true);
      toast({
        title: "Senha redefinida com sucesso!",
        description: "Você será redirecionado para o dashboard.",
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 2500);
    } catch {
      toast({
        title: "Erro ao redefinir senha",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Verificando link...</p>
        </div>
      </div>
    );
  }

  // ── Invalid / expired link ─────────────────────────────────────────────────

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="p-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Link>
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-border/50 shadow-card">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 gradient-hero rounded-xl p-3 w-fit">
                <Heart className="h-8 w-8 text-primary-foreground" fill="currentColor" />
              </div>
              <CardTitle className="font-heading text-destructive">Link inválido ou expirado</CardTitle>
              <CardDescription>
                O link de recuperação de senha é inválido ou expirou.
                Links são válidos por tempo limitado e podem ser usados apenas uma vez.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full gradient-hero text-primary-foreground">
                <Link to="/auth?tab=forgot">Solicitar novo link</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">Voltar ao login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border/50 shadow-card">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 bg-green-100 rounded-full p-4 w-fit">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="font-heading text-green-600">Senha redefinida!</CardTitle>
            <CardDescription>
              Sua senha foi alterada com sucesso. Redirecionando para o dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // ── Reset form ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="p-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/auth" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 justify-center mb-8">
            <div className="gradient-hero rounded-xl p-2.5">
              <Heart className="h-6 w-6 text-primary-foreground" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">Novità</h1>
              <p className="text-xs text-primary">Home Care & Telemedicina</p>
            </div>
          </div>

          <Card className="border-border/50 shadow-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                {isRecoveryFlow ? "Redefinir senha" : "Alterar senha"}
              </CardTitle>
              <CardDescription>
                {isRecoveryFlow
                  ? "Crie uma nova senha segura para sua conta"
                  : "Digite sua nova senha abaixo"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      required
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Repita a senha"
                      required
                      autoComplete="new-password"
                      minLength={8}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full gradient-hero text-primary-foreground"
                  disabled={isLoading || !allRulesPassed}
                >
                  {isLoading ? "Redefinindo..." : "Redefinir senha"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
