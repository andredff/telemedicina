import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText, Stethoscope, Calendar, Download, ShoppingCart, Eye,
  ChevronDown, ChevronUp, Loader2, PenLine,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  listPrescriptions, getSignedPrescriptionUrl, type PrescriptionRecord,
} from "@/services/prescriptionService";

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
}

function PrescricaoCard({ item }: { item: PrescriptionRecord }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const date = item.consultations?.date ?? item.created_at;
  const meds = item.medications ?? [];
  const isSigned = item.status === "signed";

  const handleDownload = async () => {
    if (!item.pdf_path) return;
    setDownloading(true);
    try {
      const url = await getSignedPrescriptionUrl(item.pdf_path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Receita médica</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="h-3 w-3" />{fmt(date)}
                {item.doctor_name ? ` · ${item.doctor_name}` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {meds.length} medicamento{meds.length !== 1 ? "s" : ""}
                {isSigned && (
                  <span className="ml-2 inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <PenLine className="h-3 w-3" /> Assinada
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(v => !v)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label={open ? "Recolher" : "Expandir"}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {open && (
          <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
            {meds.map((m, i) => (
              <div key={i} className="flex gap-2 text-sm bg-muted/40 rounded-lg p-3">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{m.name}</p>
                  {m.dosage && <p className="text-xs text-muted-foreground mt-0.5">{m.dosage}{m.quantity ? ` · ${m.quantity}` : ""}</p>}
                  {m.instructions && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{m.instructions}</p>}
                </div>
              </div>
            ))}
            {item.guidance?.trim() && (
              <div className="text-sm bg-muted/40 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Orientações médicas</p>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{item.guidance}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {item.pdf_path && (
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading} className="gap-1.5 h-8">
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {downloading ? "Abrindo..." : "Baixar PDF"}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => navigate(`/consulta/${item.consultation_id}/detalhes`)}>
            <Eye className="h-3.5 w-3.5" /> Ver consulta
          </Button>
          <Button size="sm" className="gap-1.5 h-8" onClick={() => navigate("/farmacia")}>
            <ShoppingCart className="h-3.5 w-3.5" /> Comprar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const Prescriptions = () => {
  const [items, setItems] = useState<PrescriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // RLS restringe a leitura às receitas do próprio paciente (patient_id = auth.uid()).
        const data = await listPrescriptions();
        if (active) setItems(data);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated />

      <main className="page-container">
        <PageHeader
          title="Meus Receituários"
          subtitle="Visualize, analise com IA e compre os medicamentos das suas teleconsultas"
          icon={Stethoscope}
        />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-medium text-foreground mb-1">Nenhum receituário disponível</p>
              <p className="text-sm text-muted-foreground">
                As receitas emitidas pelo médico nas suas teleconsultas aparecem aqui.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map(item => <PrescricaoCard key={item.id} item={item} />)}
          </div>
        )}
      </main>

      <ActiveConsultationBanner />
    </div>
  );
};

export default Prescriptions;
