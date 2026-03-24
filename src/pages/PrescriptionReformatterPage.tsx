import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Wand2 } from "lucide-react";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import { PrescriptionReformatter } from "@/components/prescription/PrescriptionReformatter";
import { supabase } from "@/integrations/supabase/client";

/** Estado passado via navigate(..., { state: ... }) */
interface ReformatterLocationState {
  pdfUrl?: string;
  doctorName?: string;
  specialty?: string;
  date?: string;
  patientName?: string;
  consultationId?: number;
}

const PrescriptionReformatterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  const state = (location.state as ReformatterLocationState) || {};
  const { pdfUrl, doctorName, specialty, date, patientName, consultationId } = state;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) navigate("/auth");
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />

      <main className="page-container">
        <PageHeader
          title="Reformatar Receita"
          subtitle={
            consultationId
              ? `Consulta #${consultationId}${specialty ? ` · ${specialty}` : ""}${doctorName ? ` · ${doctorName}` : ""}`
              : "Faça upload do PDF original, revise os dados extraídos e baixe a nova receita com o layout profissional Novità."
          }
          icon={Wand2}
          crumbs={[{ label: "Receituários", to: "/prescriptions" }]}
        />

        <div className="max-w-3xl mx-auto">
          <PrescriptionReformatter
            initialPdfUrl={pdfUrl}
            initialMeta={
              doctorName || specialty || date || patientName
                ? { doctorName, specialty, date, patientName }
                : undefined
            }
          />
        </div>
      </main>
    </div>
  );
};

export default PrescriptionReformatterPage;
