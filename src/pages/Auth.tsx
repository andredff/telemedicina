import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Pill } from "lucide-react";
import heroDoctor from "@/assets/hero-doctor.png";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Demo credentials
    if (email === "demo@novita.com.br" && password === "demo123") {
      setTimeout(() => {
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("userEmail", email);
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo ao Novità Medicamentos",
        });
        navigate("/dashboard");
      }, 1000);
    } else {
      setTimeout(() => {
        setIsLoading(false);
        toast({
          title: "Erro ao fazer login",
          description: "Credenciais inválidas. Use demo@novita.com.br / demo123",
          variant: "destructive",
        });
      }, 1000);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(() => {
      toast({
        title: "Cadastro realizado!",
        description: "Sua conta foi criada. Faça login para continuar.",
      });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Hero image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
        <img 
          src={heroDoctor} 
          alt="Profissional de saúde" 
          className="object-cover w-full h-full"
        />
        <div className="absolute bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-background/95 to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-primary rounded-lg p-3">
              <Pill className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-primary">Novità</h1>
              <p className="text-sm text-muted-foreground">Medicamentos</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Seus medicamentos, na palma da mão
          </h2>
          <p className="text-muted-foreground text-lg">
            Gerencie receituários e compre medicamentos de forma prática e segura
          </p>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="bg-primary rounded-lg p-2">
              <Pill className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Novità</h1>
              <p className="text-xs text-muted-foreground">Medicamentos</p>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Cadastro</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Acesse sua conta</CardTitle>
                  <CardDescription>
                    Digite suas credenciais para acessar seus receituários
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
                        defaultValue="demo@novita.com.br"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        defaultValue="demo123"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Entrando..." : "Entrar"}
                    </Button>
                    <p className="text-sm text-muted-foreground text-center mt-4">
                      Demo: demo@novita.com.br / demo123
                    </p>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card>
                <CardHeader>
                  <CardTitle>Criar conta</CardTitle>
                  <CardDescription>
                    Cadastre-se para gerenciar seus receituários
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha</Label>
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Cadastrando..." : "Criar conta"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;
