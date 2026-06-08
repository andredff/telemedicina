import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Stethoscope } from "lucide-react";

const Especialistas = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated />

      <main className="page-container">
        <PageHeader
          title="Especialistas"
          subtitle="Agende consultas com especialistas"
          icon={Stethoscope}
        />

        <Card>
          <CardContent className="py-12 text-center">
            <Stethoscope className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Serviço de consultas com especialistas temporariamente indisponível.</p>
          </CardContent>
        </Card>
      </main>

      <ActiveConsultationBanner />
    </div>
  );
};

export default Especialistas;
