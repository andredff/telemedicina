import { useNavigate } from "react-router-dom";
import { Video } from "lucide-react";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";

const Teleconsultas = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />
      <main className="page-container !max-w-4xl">
        <PageHeader
          title="Consulta Imediata"
          subtitle="Atendimento com clínico geral 24h, sem agendamento"
          icon={Video}
        />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">
            Serviço de teleconsulta temporariamente indisponível.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Teleconsultas;
