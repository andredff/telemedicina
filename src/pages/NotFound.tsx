import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ArrowLeft, Search, FileQuestion } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    logger.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-2xl border-border/50 shadow-card">
        <CardContent className="pt-12 pb-12 text-center">
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl"></div>
              <div className="relative rounded-full bg-gradient-to-br from-primary to-primary/60 p-6">
                <FileQuestion className="h-16 w-16 text-primary-foreground" />
              </div>
            </div>
          </div>
          
          <h1 className="mb-4 text-6xl font-heading font-bold text-primary">404</h1>
          <h2 className="mb-3 text-2xl font-heading font-semibold text-primary">
            Página não encontrada
          </h2>
          <p className="mb-8 text-muted-foreground max-w-md mx-auto">
            A página que você está procurando não existe ou foi movida. 
            Verifique o endereço ou retorne à página inicial.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button 
              onClick={() => navigate(-1)}
              variant="outline"
              className="gap-2 min-w-[160px]"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            
            <Button 
              onClick={() => navigate("/")}
              className="gap-2 min-w-[160px] gradient-hero"
            >
              <Home className="h-4 w-4" />
              Página Inicial
            </Button>
          </div>

          <div className="mt-8 pt-8 border-t border-border/50">
            <p className="text-sm text-muted-foreground mb-4">
              Precisa de ajuda? Explore nossas páginas principais:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/prescriptions")}
              >
                <Search className="h-3.5 w-3.5 mr-1.5" />
                Buscar Receita
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/medicamentos")}
              >
                Medicamentos
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/planos")}
              >
                Planos
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/como-funciona")}
              >
                Como Funciona
              </Button>
            </div>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Caminho tentado: <code className="bg-muted px-2 py-1 rounded">{location.pathname}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
