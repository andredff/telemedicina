import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Stethoscope } from "lucide-react";

const Prescriptions = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated />

      <main className="page-container">
        <PageHeader
          title="Meus Receituários"
          subtitle="Visualize, analise com IA e compre os medicamentos das suas teleconsultas"
          icon={Stethoscope}
        />

        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum receituário disponível</p>
          </CardContent>
        </Card>
      </main>

      <ActiveConsultationBanner />
    </div>
  );
};

export default Prescriptions;
