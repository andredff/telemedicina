import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Stethoscope, Clock, FileText, FlaskConical, ClipboardCheck,
  Printer, ShoppingCart, PenLine, CheckCircle, XCircle, Loader2,
  AlertCircle, Pill, Paperclip, Activity, User,
} from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  loadConsultaDraft, draftHasDocuments, printReceita, printExames, printAtestado,
  intakeHasContent, type ConsultaDraft, type IntakeData,
} from "@/lib/consultaDraft";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConsultaInfo {
  id: string;
  patient_name: string;
  doctor_name: string;
  doctor_crm: string;
  date: string;
  status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  pending:     { label: "Aguardando", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: Clock },
  in_progress: { label: "Em atendimento", cls: "bg-green-50 text-green-700 border-green-200", Icon: Stethoscope },
  completed:   { label: "Concluída", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle },
  cancelled:   { label: "Cancelada", cls: "bg-slate-100 text-slate-500 border-slate-200", Icon: XCircle },
};

const PRIORITY_CFG: Record<string, { label: string; cls: string }> = {
  routine:   { label: "Rotina", cls: "bg-gray-100 text-gray-600" },
  urgent:    { label: "Urgente", cls: "bg-amber-100 text-amber-700" },
  emergency: { label: "Emergência", cls: "bg-red-100 text-red-700" },
};

function fmtDateTime(d: string) {
  try { return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return d; }
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, count, accent, action, children,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  accent: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">{title}</h3>
            {typeof count === "number" && (
              <p className="text-xs text-muted-foreground">{count} {count === 1 ? "item" : "itens"}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConsultaDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [consulta, setConsulta] = useState<ConsultaInfo | null>(null);
  const [draft, setDraft] = useState<ConsultaDraft | null>(null);
  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const { data } = await supabase
        .from("consultations")
        .select("id, patient_name, doctor_name, doctor_crm, date, status, created_at, clinical_data, intake_data")
        .eq("id", id)
        .single();
      const row = data as unknown as
        | (ConsultaInfo & { clinical_data?: ConsultaDraft | null; intake_data?: IntakeData | null })
        | null;
      setConsulta(row);
      // Prefer DB-persisted clinical data; fall back to local draft (same browser)
      setDraft(row?.clinical_data ?? loadConsultaDraft(id));
      setIntake(row?.intake_data ?? null);
      setLoading(false);
    };
    load();
  }, [id]);

  const printMeta = consulta
    ? {
        doctorName: consulta.doctor_name || "Médico Novità",
        doctorCrm: consulta.doctor_crm || "",
        patientName: consulta.patient_name,
        date: consulta.date || consulta.created_at,
      }
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!consulta) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAuthenticated onLogout={async () => { await supabase.auth.signOut(); navigate("/auth"); }} />
        <main className="page-container !max-w-2xl flex flex-col items-center justify-center py-24 gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Consulta não encontrada</h1>
          <Button variant="outline" onClick={() => navigate("/teleconsultas")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar para consultas
          </Button>
        </main>
      </div>
    );
  }

  const st = STATUS_LABEL[consulta.status] ?? STATUS_LABEL.completed;
  const hasDocs = draftHasDocuments(draft);
  const isCompleted = consulta.status === "completed";

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={async () => { await supabase.auth.signOut(); navigate("/auth"); }} />

      <main className="page-container !max-w-3xl space-y-5">
        {/* Back */}
        <button
          onClick={() => navigate("/teleconsultas")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para consultas
        </button>

        {/* Summary header */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Stethoscope className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-foreground leading-tight">Clínico Geral</h1>
                  <p className="text-sm text-muted-foreground truncate">
                    {consulta.doctor_name || "Atendimento de teleconsulta"}
                    {consulta.doctor_crm ? ` · ${consulta.doctor_crm}` : ""}
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${st.cls}`}>
                <st.Icon className="h-3.5 w-3.5" />
                {st.label}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/60 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {fmtDateTime(consulta.created_at || consulta.date)}
              </span>
              <span className="font-mono">#{consulta.id.slice(0, 8)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Patient's own pre-consultation submission */}
        {intakeHasContent(intake) && intake && (
          <Section icon={User} title="Informações que você enviou" accent="bg-blue-50 text-blue-600">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Activity className="h-3.5 w-3.5" /> Sintomas
                </p>
                {intake.sintomas.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {intake.sintomas.map((s) => (
                      <span
                        key={s}
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          s === intake.sintomaPrincipal
                            ? "bg-amber-100 text-amber-800 border-amber-300 font-medium"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                      >
                        {s}{s === intake.sintomaPrincipal ? " · principal" : ""}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhum sintoma informado</p>
                )}
              </div>

              {intake.medicamentos?.trim() && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Pill className="h-3.5 w-3.5" /> Medicamentos em uso
                  </p>
                  <p className="text-sm text-foreground/80">{intake.medicamentos}</p>
                </div>
              )}

              {intake.exames.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> Exames enviados
                  </p>
                  <div className="space-y-1.5">
                    {intake.exames.map((ex, i) => (
                      <a
                        key={i}
                        href={ex.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg border bg-white hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm text-foreground"
                      >
                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="flex-1 truncate">{ex.name}</span>
                        <span className="text-xs text-primary">Abrir</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Documents unavailable / not yet emitted */}
        {!hasDocs && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">
                {isCompleted ? "Nenhum documento disponível neste dispositivo" : "Documentos ainda não emitidos"}
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                {isCompleted
                  ? "Os documentos (receita, exames, atestado) são emitidos pelo médico durante o atendimento e podem não estar disponíveis neste dispositivo."
                  : "Receita, pedidos de exame e atestado ficarão disponíveis aqui após a conclusão da consulta."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Anamnese / clinical notes */}
        {draft?.anamnese?.trim() && (
          <Section icon={Stethoscope} title="Resumo clínico" accent="bg-blue-50 text-blue-600">
            <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{draft.anamnese}</p>
          </Section>
        )}

        {/* Receituário */}
        {draft && draft.medications.length > 0 && printMeta && (
          <Section
            icon={Pill}
            title="Receituário"
            count={draft.medications.length}
            accent="bg-emerald-50 text-emerald-600"
            action={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => printReceita(draft.medications, printMeta)}>
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </Button>
                <Button size="sm" className="gap-1.5 h-8" onClick={() => navigate("/farmacia")}>
                  <ShoppingCart className="h-3.5 w-3.5" /> Comprar
                </Button>
              </div>
            }
          >
            <div className="space-y-2.5">
              {draft.medications.map((m, i) => (
                <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl border bg-white">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground">{m.name}</p>
                    {m.dosage && <p className="text-xs text-muted-foreground mt-0.5">{m.dosage}{m.quantity ? ` · ${m.quantity}` : ""}</p>}
                    {m.instructions && <p className="text-xs text-foreground/60 mt-1 italic">{m.instructions}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Exames */}
        {draft && draft.examRequests.length > 0 && printMeta && (
          <Section
            icon={FlaskConical}
            title="Pedidos de exame"
            count={draft.examRequests.length}
            accent="bg-violet-50 text-violet-600"
            action={
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => printExames(draft.examRequests, printMeta)}>
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
            }
          >
            <div className="space-y-2.5">
              {draft.examRequests.map((e) => {
                const p = PRIORITY_CFG[e.priority] ?? PRIORITY_CFG.routine;
                return (
                  <div key={e.id} className="flex items-start gap-3 p-3 rounded-xl border bg-white">
                    <FlaskConical className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground">{e.name}</p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${p.cls}`}>{p.label}</span>
                      </div>
                      {e.justification && <p className="text-xs text-muted-foreground mt-1">{e.justification}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Atestado */}
        {draft?.certificate && printMeta && (
          <Section
            icon={ClipboardCheck}
            title="Atestado médico"
            accent="bg-amber-50 text-amber-600"
            action={
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => printAtestado(draft.certificate!, printMeta)}>
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
            }
          >
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Afastamento</span>
                <span className="font-medium text-foreground">
                  {draft.certificate.days} dia{Number(draft.certificate.days) > 1 ? "s" : ""}
                </span>
              </div>
              {draft.certificate.cidCode && (
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">CID-10</span>
                  <span className="font-medium text-foreground">{draft.certificate.cidCode}</span>
                </div>
              )}
              {draft.certificate.reason && (
                <div className="pt-1">
                  <p className="text-muted-foreground mb-0.5">Diagnóstico</p>
                  <p className="text-foreground/80">{draft.certificate.reason}</p>
                </div>
              )}
              {draft.certificate.notes && (
                <div className="pt-1">
                  <p className="text-muted-foreground mb-0.5">Observações</p>
                  <p className="text-foreground/80">{draft.certificate.notes}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Signature note */}
        {hasDocs && draft?.signed && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <PenLine className="h-4 w-4 shrink-0" />
            <span>
              Documentos assinados digitalmente
              {draft.signedAt ? ` em ${fmtDateTime(draft.signedAt)}` : ""}.
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
