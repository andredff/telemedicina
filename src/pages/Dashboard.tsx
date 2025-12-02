import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { mockPrescriptions } from "@/data/mockPrescriptions";
import { FileText, Calendar, User, ChevronRight } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userEmail");
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

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Meus Receituários
          </h1>
          <p className="text-muted-foreground">
            Gerencie e compre medicamentos dos seus receituários médicos
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockPrescriptions.map((prescription) => (
            <Card 
              key={prescription.id} 
              className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
              onClick={() => navigate(`/prescription/${prescription.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{prescription.id}</CardTitle>
                  </div>
                  {getStatusBadge(prescription.status)}
                </div>
                <CardDescription className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="text-sm">{prescription.patientName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">
                      {new Date(prescription.date).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Médico responsável
                    </p>
                    <p className="text-sm font-semibold">{prescription.doctorName}</p>
                    <p className="text-xs text-muted-foreground">{prescription.doctorCRM}</p>
                  </div>
                  
                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Medicamentos
                    </p>
                    <p className="text-sm font-semibold">
                      {prescription.medications.length} {prescription.medications.length === 1 ? "item" : "itens"}
                    </p>
                  </div>

                  <Button className="w-full gap-2" variant="default">
                    Ver detalhes
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
