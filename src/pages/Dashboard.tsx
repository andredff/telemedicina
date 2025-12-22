import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Calendar, 
  User, 
  ChevronRight, 
  Video, 
  Pill, 
  CreditCard,
  Clock,
  Plus,
  Heart,
  LogOut,
  ShoppingCart,
  Settings,
  Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { mockPrescriptions } from "@/data/mockPrescriptions";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        } else if (session.user) {
          // Defer profile fetch to avoid deadlock
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
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

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "default",
      partial: "secondary",
      completed: "outline",
    } as const;

    const labels = {
      pending: "Pendente",
      partial: "Parcial",
      completed: "Concluído",
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const userName = profile?.full_name || user?.user_metadata?.full_name || "Paciente";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-md border-b border-border/50 shadow-soft">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="gradient-hero rounded-xl p-2">
              <Heart className="h-5 w-5 text-primary-foreground" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-lg font-heading font-bold text-foreground">Novità</h1>
              <p className="text-xs text-primary -mt-0.5">Home Care & Telemedicina</p>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/cart")}>
              <ShoppingCart className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </nav>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-2">
            Olá, {userName.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas consultas e receitas médicas
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all cursor-pointer group">
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Consulta Imediata</p>
                <p className="text-xs text-muted-foreground">Clínico geral 24h</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all cursor-pointer group">
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <Calendar className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="font-medium text-foreground">Agendar</p>
                <p className="text-xs text-muted-foreground">Especialistas</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all cursor-pointer group" onClick={() => navigate("/medicamentos")}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-medical-green/10 flex items-center justify-center group-hover:bg-medical-green/20 transition-colors">
                <Pill className="h-6 w-6 text-medical-green" />
              </div>
              <div>
                <p className="font-medium text-foreground">Medicamentos</p>
                <p className="text-xs text-muted-foreground">Entrega em casa</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50 hover:shadow-card hover:border-primary/20 transition-all cursor-pointer group" onClick={() => navigate("/orders")}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-medical-orange/10 flex items-center justify-center group-hover:bg-medical-orange/20 transition-colors">
                <Package className="h-6 w-6 text-medical-orange" />
              </div>
              <div>
                <p className="font-medium text-foreground">Meus Pedidos</p>
                <p className="text-xs text-muted-foreground">Acompanhe entregas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Card */}
        <Card className="mb-8 gradient-hero border-0 text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-primary-foreground/80">Seu plano atual</p>
                <h3 className="text-2xl font-heading font-bold">Plano Bronze</h3>
                <p className="text-sm text-primary-foreground/80 mt-1">
                  Consultas ilimitadas com clínico geral • Válido até 15/01/2025
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" className="bg-card text-foreground hover:bg-card/90">
                  Fazer upgrade
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prescriptions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading font-semibold text-foreground">
              Meus Receituários
            </h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary"
              onClick={() => navigate("/prescriptions")}
            >
              Ver todos
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mockPrescriptions.slice(0, 3).map((prescription) => (
              <Card 
                key={prescription.id} 
                className="bg-card border-border/50 cursor-pointer transition-all hover:shadow-card hover:border-primary/20"
                onClick={() => navigate(`/prescription/${prescription.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{prescription.id}</CardTitle>
                    </div>
                    {getStatusBadge(prescription.status)}
                  </div>
                  <CardDescription className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {prescription.patientName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(prescription.date).toLocaleDateString("pt-BR")}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Médico</p>
                      <p className="text-sm font-medium">{prescription.doctorName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Medicamentos</p>
                      <p className="text-sm font-medium">{prescription.medications.length} itens</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-heading font-semibold text-foreground mb-4">
            Atividade Recente
          </h2>
          <Card className="bg-card border-border/50">
            <CardContent className="p-0 divide-y divide-border/50">
              {[
                { icon: Video, title: "Consulta realizada", desc: "Dr. João Silva • Clínico Geral", time: "Hoje, 14:30" },
                { icon: FileText, title: "Nova receita disponível", desc: "2 medicamentos prescritos", time: "Hoje, 14:45" },
                { icon: Pill, title: "Pedido de medicamentos", desc: "Em preparação • Entrega amanhã", time: "Ontem, 10:00" },
              ].map((activity, index) => (
                <div key={index} className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <activity.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">{activity.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {activity.time}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;