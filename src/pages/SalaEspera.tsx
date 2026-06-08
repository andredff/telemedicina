import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";

export default function SalaEspera() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Header
        isAuthenticated
        onLogout={async () => {
          await supabase.auth.signOut();
          navigate("/auth");
        }}
      />
      <div className="mx-auto max-w-4xl px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/teleconsultas")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">Sala de espera indisponível.</p>
      </div>
    </div>
  );
}
