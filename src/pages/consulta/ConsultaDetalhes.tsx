import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Stethoscope, Clock, FileText, FlaskConical, ClipboardCheck,
  Printer, ShoppingCart, PenLine, CheckCircle, XCircle, Loader2,
  AlertCircle, Pill, Paperclip, Activity, User, Download,
} from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  loadConsultaDraft, draftHasDocuments, printReceita, printExames, printAtestado,
  intakeHasContent, type ConsultaDraft, type IntakeData,
} from "@/lib/consultaDraft";
import { openExamFile } from "@/lib/examFiles";
import { getPrescriptionByConsultation, getSignedPrescriptionUrl, type PrescriptionRecord } from "@/services/prescriptionService";
import { getConsultationDocuments, getSignedDocumentUrl, type ConsultationDocumentRecord } from "@/services/consultationDocumentService";
import { logEvent } from "@/lib/audit";
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
  number?: number | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  waiting_attendant: { label: "Aguardando atendente", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: Clock },
  with_attendant:    { label: "Em triagem", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: Clock },
  waiting_doctor:    { label: "Aguardando médico", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: Clock },
  routed_to_doctor:  { label: "Médico chamando", cls: "bg-green-50 text-green-700 border-green-200", Icon: Stethoscope },
  in_consultation:   { label: "Em consulta", cls: "bg-green-50 text-green-700 border-green-200", Icon: Stethoscope },
  completed:         { label: "Concluída", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle },
  cancelled:         { label: "Cancelada", cls: "bg-slate-100 text-slate-500 border-slate-200", Icon: XCircle },
  // Legacy values (pre-triage migration)
  pending:     { label: "Aguardando", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: Clock },
  in_progress: { label: "Em atendimento", cls: "bg-green-50 text-green-700 border-green-200", Icon: Stethoscope },
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
  const [signedRxUrl, setSignedRxUrl] = useState<string | null>(null);
  const [rx, setRx] = useState<PrescriptionRecord | null>(null);
  const [examDoc, setExamDoc] = useState<ConsultationDocumentRecord | null>(null);
  const [certDoc, setCertDoc] = useState<ConsultationDocumentRecord | null>(null);
  const [examPdfUrl, setExamPdfUrl] = useState<string | null>(null);
  const [certPdfUrl, setCertPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const { data } = await supabase
        .from("consultations")
        .select("id, patient_name, doctor_name, doctor_crm, date, status, created_at, clinical_data, intake_data, number")
        .eq("id", id)
        .single();
      const row = data as unknown as
        | (ConsultaInfo & { clinical_data?: ConsultaDraft | null; intake_data?: IntakeData | null })
        | null;
      setConsulta(row);
      // Prefer DB-persisted clinical data; fall back to local draft (same browser)
      const clinical = row?.clinical_data ?? loadConsultaDraft(id);
      setDraft(clinical);
      setIntake(row?.intake_data ?? null);
      // Receita de 1ª classe (tabela consultation_prescriptions + PDF assinado).
      // É a fonte autoritativa da receita — pode existir mesmo quando o
      // clinical_data (rascunho) não foi persistido na linha da consulta.
      let rxRec: PrescriptionRecord | null = null;
      try {
        rxRec = await getPrescriptionByConsultation(id);
        if (rxRec) {
          setRx(rxRec);
          if (rxRec.pdf_path) setSignedRxUrl(await getSignedPrescriptionUrl(rxRec.pdf_path));
        }
      } catch { /* sem receita assinada */ }
      // Exame/atestado assinados (tabela consultation_documents + PDF assinado).
      try {
        const docs = await getConsultationDocuments(id);
        const exam = docs.find(d => d.doc_type === 'exam_request') ?? null;
        const cert = docs.find(d => d.doc_type === 'certificate') ?? null;
        setExamDoc(exam);
        setCertDoc(cert);
        if (exam?.pdf_path) setExamPdfUrl(await getSignedDocumentUrl(exam.pdf_path));
        if (cert?.pdf_path) setCertPdfUrl(await getSignedDocumentUrl(cert.pdf_path));
      } catch { /* sem documentos assinados */ }
      if (row) {
        logEvent('patient_document_viewed', {
          consultationId: id,
          payload: {
            document_types: [
              ...((clinical?.medications?.length || rxRec?.medications?.length) ? ['prescription'] : []),
              ...(clinical?.examRequests?.length ? ['exam_request'] : []),
              ...(clinical?.certificate ? ['certificate'] : []),
            ],
          },
        });
      }
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
  // Receita: prefere os medicamentos do rascunho (clinical_data); cai para o
  // registro assinado (consultation_prescriptions) quando o rascunho não foi
  // persistido — assim a receita sempre aparece para o paciente.
  const rxMeds: { id?: string; name: string; dosage?: string; quantity?: string; instructions?: string }[] =
    (draft?.medications?.length ? draft.medications : rx?.medications) ?? [];
  const rxSigned = draft?.signed || rx?.status === "signed";
  const rxSignedAt = draft?.signedAt ?? rx?.signed_at ?? null;
  // Exame/atestado: preferem o rascunho (clinical_data); caem para o documento
  // assinado (consultation_documents) quando o rascunho não foi persistido.
  const examItems: { id?: string; name: string; priority: string; justification?: string }[] =
    (draft?.examRequests?.length
      ? draft.examRequests
      : (examDoc?.content as { exams?: { name: string; priority: string; justification?: string }[] } | undefined)?.exams) ?? [];
  const certData = draft?.certificate
    ?? (certDoc?.content as { days?: string; startDate?: string; cidCode?: string; reason?: string; notes?: string } | undefined)
    ?? null;
  const hasCert = !!(certData && (certData.days || certData.reason));
  const hasDocs = draftHasDocuments(draft) || rxMeds.length > 0 || examItems.length > 0 || hasCert;
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
              <span className="font-mono">#{consulta.number ?? consulta.id.slice(0, 8)}</span>
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
                      <button
                        key={i}
                        type="button"
                        onClick={() => openExamFile(ex)}
                        className="flex w-full items-center gap-2 p-2 rounded-lg border bg-white hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm text-foreground text-left"
                      >
                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="flex-1 truncate">{ex.name}</span>
                        <span className="text-xs text-primary">Abrir</span>
                      </button>
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
        {rxMeds.length > 0 && printMeta && (
          <Section
            icon={Pill}
            title="Receituário"
            count={rxMeds.length}
            accent="bg-emerald-50 text-emerald-600"
            action={
              <div className="flex items-center gap-2">
                {signedRxUrl ? (
                  <Button asChild variant="outline" size="sm" className="gap-1.5 h-8">
                    <a href={signedRxUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-3.5 w-3.5" /> Receita assinada
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => printReceita(rxMeds, printMeta)}>
                    <Printer className="h-3.5 w-3.5" /> Imprimir
                  </Button>
                )}
                <Button size="sm" className="gap-1.5 h-8" onClick={() => navigate("/farmacia")}>
                  <ShoppingCart className="h-3.5 w-3.5" /> Comprar
                </Button>
              </div>
            }
          >
            <div className="space-y-2.5">
              {rxMeds.map((m, i) => (
                <div key={m.id ?? i} className="flex items-start gap-3 p-3 rounded-xl border bg-white">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground">{m.name}</p>
                    {m.dosage && <p className="text-xs text-muted-foreground mt-0.5">{m.dosage}{m.quantity ? ` · ${m.quantity}` : ""}</p>}
                    {m.instructions && <p className="text-xs text-foreground/60 mt-1 italic">{m.instructions}</p>}
                  </div>
                </div>
              ))}
              {rx?.guidance?.trim() && (
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Orientações médicas</p>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{rx.guidance}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Exames */}
        {examItems.length > 0 && printMeta && (
          <Section
            icon={FlaskConical}
            title="Pedidos de exame"
            count={examItems.length}
            accent="bg-violet-50 text-violet-600"
            action={
              examPdfUrl ? (
                <Button asChild variant="outline" size="sm" className="gap-1.5 h-8">
                  <a href={examPdfUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5" /> Pedido assinado
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => printExames(examItems as typeof draft.examRequests, printMeta)}>
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </Button>
              )
            }
          >
            <div className="space-y-2.5">
              {examItems.map((e, i) => {
                const p = PRIORITY_CFG[e.priority] ?? PRIORITY_CFG.routine;
                return (
                  <div key={e.id ?? i} className="flex items-start gap-3 p-3 rounded-xl border bg-white">
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
        {hasCert && certData && printMeta && (
          <Section
            icon={ClipboardCheck}
            title="Atestado médico"
            accent="bg-amber-50 text-amber-600"
            action={
              certPdfUrl ? (
                <Button asChild variant="outline" size="sm" className="gap-1.5 h-8">
                  <a href={certPdfUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5" /> Atestado assinado
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => printAtestado(certData as Parameters<typeof printAtestado>[0], printMeta)}>
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </Button>
              )
            }
          >
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Afastamento</span>
                <span className="font-medium text-foreground">
                  {certData.days} dia{Number(certData.days) > 1 ? "s" : ""}
                </span>
              </div>
              {certData.cidCode && (
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">CID-10</span>
                  <span className="font-medium text-foreground">{certData.cidCode}</span>
                </div>
              )}
              {certData.reason && (
                <div className="pt-1">
                  <p className="text-muted-foreground mb-0.5">Diagnóstico</p>
                  <p className="text-foreground/80">{certData.reason}</p>
                </div>
              )}
              {certData.notes && (
                <div className="pt-1">
                  <p className="text-muted-foreground mb-0.5">Observações</p>
                  <p className="text-foreground/80">{certData.notes}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Signature note */}
        {hasDocs && (rxSigned || !!examDoc || !!certDoc) && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <PenLine className="h-4 w-4 shrink-0" />
            <span>
              Documentos assinados digitalmente
              {(rxSignedAt ?? examDoc?.signed_at ?? certDoc?.signed_at)
                ? ` em ${fmtDateTime((rxSignedAt ?? examDoc?.signed_at ?? certDoc?.signed_at) as string)}`
                : ""}.
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
