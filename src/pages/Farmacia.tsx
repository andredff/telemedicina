import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  FileText, 
  ShoppingCart,
  Pill,
  User,
  Calendar,
  ChevronRight,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SearchClient } from "@/integrations/supabase/searchClient";
import { logger } from "@/lib/logger";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";

interface Prescription {
  id: string;
  patient_name: string;
  doctor_name: string;
  doctor_crm: string;
  date: string;
  status: string;
}

const Farmacia = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [prescriptionCode, setPrescriptionCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentPrescriptions, setRecentPrescriptions] = useState<Prescription[]>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (!session) {
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadRecentPrescriptions();
    }
  }, [user]);

  useEffect(() => {
    if (prescriptionCode.length > 1) {
      const getSuggestions = async () => {
        try {
          const suggestions = await SearchClient.getSearchSuggestions(prescriptionCode);
          setSuggestions(suggestions);
        } catch (error) {
          logger.error("Error getting suggestions:", error);
          setSuggestions([]);
        }
      };
      getSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [prescriptionCode]);

  const loadRecentPrescriptions = async () => {
    if (!user) return;
    
    setLoadingPrescriptions(true);
    try {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("id, patient_name, doctor_name, doctor_crm, date, status")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentPrescriptions(data || []);
    } catch (error) {
      logger.error("Error loading prescriptions:", error);
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSearch = async () => {
    if (!prescriptionCode.trim()) {
      toast({
        title: "Código obrigatório",
        description: "Por favor, insira o código da sua receita.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    
    try {
      const prescription = await SearchClient.getPrescriptionById(prescriptionCode.toUpperCase());
      
      setIsSearching(false);
      
      if (prescription) {
        navigate(`/prescription/${prescription.id}`);
      } else {
        toast({
          title: "Receita não encontrada",
          description: "Verifique o código e tente novamente.",
        });
      }
    } catch (error) {
      logger.error("Error searching prescription:", error);
      setIsSearching(false);
      toast({
        title: "Erro na busca",
        description: "Ocorreu um erro ao buscar a receita. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "completed":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "completed":
        return "Concluída";
      case "cancelled":
        return "Cancelada";
      default:
        return status;
    }
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
      <Header 
        isAuthenticated 
        onLogout={handleLogout}
        title="Farmácia"
      />

      <main className="container mx-auto px-4 py-8">
        <BackLink />

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            Farmácia Online
          </h1>
          <p className="text-muted-foreground">
            Busque sua receita e solicite medicamentos para entrega em casa
          </p>
        </div>

        {/* Search Card */}
        <Card className="mb-8 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Buscar Receita
            </CardTitle>
            <CardDescription>
              Digite o código da receita recebido por e-mail ou SMS após sua consulta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder="Ex: RX-2024-XXXXX"
                  value={prescriptionCode}
                  onChange={(e) => setPrescriptionCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 hover:bg-muted cursor-pointer text-sm"
                        onClick={() => {
                          setPrescriptionCode(suggestion);
                          setSuggestions([]);
                        }}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={isSearching}
                className="gap-2"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate("/prescriptions")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Minhas Receitas</p>
                <p className="text-sm text-muted-foreground">Ver todas as receitas</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate("/cart")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Meu Carrinho</p>
                <p className="text-sm text-muted-foreground">Ver itens selecionados</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate("/orders")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-medical-green/10 flex items-center justify-center">
                <Pill className="h-6 w-6 text-medical-green" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Meus Pedidos</p>
                <p className="text-sm text-muted-foreground">Acompanhar entregas</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        {/* Recent Prescriptions */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Receitas Recentes
            </CardTitle>
            <CardDescription>
              Suas últimas receitas médicas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPrescriptions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : recentPrescriptions.length > 0 ? (
              <div className="space-y-3">
                {recentPrescriptions.map((prescription) => (
                  <div
                    key={prescription.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/prescription/${prescription.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{prescription.id}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {prescription.doctor_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(prescription.date).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`${getStatusColor(prescription.status)} text-white`}>
                        {getStatusText(prescription.status)}
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma receita encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Suas receitas aparecerão aqui após suas consultas
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Farmacia;
