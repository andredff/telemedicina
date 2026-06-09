import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Video, Clock, CheckCircle, XCircle, Loader2, AlertCircle,
  Stethoscope, Plus, RefreshCw, Ban, ChevronRight, Star, CreditCard,
  Eye, FileText, FlaskConical, ClipboardCheck, PhoneCall, ShieldCheck, Sparkles,
} from "lucide-react";
import type { ConsultaDraft } from "@/lib/consultaDraft";
import { createRingtone } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ConsultaWizardModal, WizardIntake } from "@/components/telemedicine/ConsultaWizardModal";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { User } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsultaRow {
  id: string;
  patient_name: string;
  doctor_name: string;
  doctor_crm: string;
  date: string;
  status: string;
  created_at: string;
  user_id: string;
  clinical_data?: ConsultaDraft | null;
  doctor_calling_at?: string | null;
}

interface CreditRow {
  id: string;
  type: string;
  amount: number;
  expires_at: string;
}

type ConsultaStatus = "AGUARDANDO" | "EM_ATENDIMENTO" | "CONCLUIDO" | "CANCELADO";
type FilterKey = "todos" | ConsultaStatus;

function mapStatus(raw: string): ConsultaStatus {
  if (raw === "in_progress") return "EM_ATENDIMENTO";
  if (raw === "completed")   return "CONCLUIDO";
  if (raw === "cancelled")   return "CANCELADO";
  return "AGUARDANDO";
}

// ─── Status visual config ────────────────────────────────────────────────────

const STATUS_CFG: Record<ConsultaStatus, {
  barBg: string; borderColor: string; iconBg: string; iconColor: string;
  label: string; ping?: boolean; pulse?: boolean;
}> = {
  AGUARDANDO: {
    barBg: "bg-gradient-to-r from-amber-500 to-orange-500",
    borderColor: "border-amber-200", iconBg: "bg-amber-50 border border-amber-200",
    iconColor: "text-amber-600", label: "Aguardando Atendimento", ping: true,
  },
  EM_ATENDIMENTO: {
    barBg: "bg-green-500",
    borderColor: "border-green-200", iconBg: "bg-green-50 border border-green-200",
    iconColor: "text-green-600", label: "Em Atendimento", pulse: true,
  },
  CONCLUIDO: {
    barBg: "bg-emerald-600",
    borderColor: "border-emerald-200", iconBg: "bg-emerald-50 border border-emerald-200",
    iconColor: "text-emerald-600", label: "Concluída",
  },
  CANCELADO: {
    barBg: "bg-slate-400",
    borderColor: "border-slate-200", iconBg: "bg-slate-50 border border-slate-200",
    iconColor: "text-slate-500", label: "Cancelada",
  },
};

// ─── Consultation History Card ────────────────────────────────────────────────

function ConsultationHistoryCard({
  consulta,
  onJoin,
  onCancel,
  onEvaluate,
  onViewDetails,
  hasBeenEvaluated,
}: {
  consulta: ConsultaRow;
  onJoin: (c: ConsultaRow) => void;
  onCancel: (id: string) => void;
  onEvaluate: (c: ConsultaRow) => void;
  onViewDetails: (c: ConsultaRow) => void;
  hasBeenEvaluated: boolean;
}) {
  const status = mapStatus(consulta.status);
  const cfg = STATUS_CFG[status];
  const doctorLabel =
    status === "CANCELADO" ? "Consulta cancelada"
    : consulta.doctor_name || (status === "AGUARDANDO" ? "Buscando médico..." : "—");

  const showJoin = status === "AGUARDANDO" || status === "EM_ATENDIMENTO";

  // Documents emitted by the doctor, persisted on the consultation row (clinical_data)
  const draft = status === "CONCLUIDO" ? consulta.clinical_data : null;
  const docChips: { icon: React.ElementType; label: string }[] = [];
  if (draft) {
    if (draft.medications?.length > 0) docChips.push({ icon: FileText, label: "Receita" });
    if (draft.examRequests?.length > 0) docChips.push({ icon: FlaskConical, label: "Exames" });
    if (draft.certificate) docChips.push({ icon: ClipboardCheck, label: "Atestado" });
  }

  return (
    <div className={`rounded-2xl overflow-hidden border ${cfg.borderColor} bg-card shadow-soft hover:shadow-card transition-shadow duration-200`}>
      {/* Status bar */}
      <div className={`${cfg.barBg} px-4 py-2.5 flex items-center gap-2`}>
        {cfg.ping && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
        )}
        {cfg.pulse && <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />}
        <Stethoscope className="h-3.5 w-3.5 text-white shrink-0" />
        <span className="text-xs font-semibold text-white uppercase tracking-wide flex-1">{cfg.label}</span>
        <span className="text-[10px] text-white/70 font-mono truncate max-w-[80px]">
          #{consulta.id.slice(0, 8)}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Specialty + doctor row */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
            <Stethoscope className={`h-5 w-5 ${cfg.iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-foreground truncate">Clínico Geral</p>
            <p className="text-xs text-muted-foreground truncate">{doctorLabel}</p>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            {format(new Date(consulta.created_at || consulta.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>

        {/* Actions — active consultations */}
        {showJoin && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => onJoin(consulta)}
              className={`flex-1 gap-2 ${status === "EM_ATENDIMENTO" ? "bg-green-500 hover:bg-green-600 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"}`}
            >
              <Video className="h-4 w-4" />
              {status === "AGUARDANDO" ? "Entrar na Sala" : "Entrar na Consulta"}
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 px-3"
              onClick={() => onCancel(consulta.id)}
              title="Cancelar consulta"
            >
              <Ban className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Actions — completed consultation: documents + details CTA */}
        {status === "CONCLUIDO" && (
          <div className="space-y-2.5 pt-1">
            {docChips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {docChips.map((d) => (
                  <span
                    key={d.label}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"
                  >
                    <d.icon className="h-3 w-3" /> {d.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">Veja o resumo e os documentos da consulta</p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onViewDetails(consulta)}
                className="flex-1 gap-2 bg-foreground text-background hover:bg-foreground/90"
              >
                <Eye className="h-4 w-4" />
                Ver detalhes
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
              <Button
                size="sm"
                variant={hasBeenEvaluated ? "ghost" : "outline"}
                className="gap-1.5 px-3"
                onClick={() => !hasBeenEvaluated && onEvaluate(consulta)}
                disabled={hasBeenEvaluated}
                title={hasBeenEvaluated ? "Consulta avaliada" : "Avaliar consulta"}
              >
                <Star className={`h-4 w-4 ${hasBeenEvaluated ? "fill-amber-400 text-amber-400" : ""}`} />
                {hasBeenEvaluated ? "Avaliada" : "Avaliar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;
  const labels = ["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"];
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => onChange(star)}
            >
              <Star className={`h-7 w-7 transition-colors ${star <= display ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground w-20">{display > 0 ? labels[display] : "—"}</span>
      </div>
    </div>
  );
}

// ─── Evaluation Modal ─────────────────────────────────────────────────────────

function EvaluationModal({
  consulta,
  onClose,
  onSuccess,
}: {
  consulta: ConsultaRow;
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const { toast } = useToast();
  const [notaAtendimento, setNotaAtendimento] = useState(0);
  const [notaAplicativo, setNotaAplicativo] = useState(0);
  const [comentario, setComentario] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (notaAtendimento === 0 || notaAplicativo === 0) {
      toast({ title: "Avaliação incompleta", description: "Por favor, avalie o atendimento e o aplicativo.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    // Simulated short delay to give UX feedback
    await new Promise(r => setTimeout(r, 600));
    toast({ title: "Avaliação enviada!", description: "Obrigado pelo seu feedback." });
    onSuccess(consulta.id);
    setIsSubmitting(false);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            Avaliar consulta
          </DialogTitle>
          <DialogDescription>
            {consulta.doctor_name
              ? `Como foi sua consulta com ${consulta.doctor_name}?`
              : "Como foi sua consulta?"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <StarRating label="Avaliação do atendimento" value={notaAtendimento} onChange={setNotaAtendimento} />
          <StarRating label="Avaliação do aplicativo" value={notaAplicativo} onChange={setNotaAplicativo} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Comentário <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Textarea
              placeholder="Conte como foi sua experiência..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || notaAtendimento === 0 || notaAplicativo === 0}
            className="gap-2"
          >
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</> : "Enviar avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Teleconsultas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [patientName, setPatientName] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  // Consultation history
  const [consultas, setConsultas] = useState<ConsultaRow[]>([]);
  const [isLoadingConsultas, setIsLoadingConsultas] = useState(false);
  const [consultaFilter, setConsultaFilter] = useState<FilterKey>("todos");

  // Credits
  const [availableCredits, setAvailableCredits] = useState<CreditRow[]>([]);

  // UI modals
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showStandaloneModal, setShowStandaloneModal] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [isCancellingConsulta, setIsCancellingConsulta] = useState(false);
  const [evaluatingConsulta, setEvaluatingConsulta] = useState<ConsultaRow | null>(null);
  const [evaluatedIds, setEvaluatedIds] = useState<Set<string>>(new Set());

  // "Doctor is calling" ring (re-join an open consultation)
  const [ringingConsulta, setRingingConsulta] = useState<{ id: string; doctorName: string } | null>(null);
  const lastRingRef = useRef<Record<string, string | null>>({});
  const ringtoneRef = useRef(createRingtone());

  // Credit to consume when wizard completes
  const pendingCreditRef = useRef<string | null>(null);

  const { isActive: hasActivePlan } = useSubscription();

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
      setPageLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // ── Load profile name ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).single().then(({ data }) => {
      if (data?.full_name) setPatientName(data.full_name);
    });
  }, [user]);

  // ── Load consultations ────────────────────────────────────────────────────

  const loadConsultas = useCallback(async () => {
    if (!user) return;
    setIsLoadingConsultas(true);
    const { data } = await supabase
      .from("consultations")
      .select("id, patient_name, doctor_name, doctor_crm, date, status, created_at, user_id, clinical_data, doctor_calling_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const rows = (data as unknown as ConsultaRow[]) ?? [];
    // Seed last-seen ring timestamps so pre-existing values don't ring on load
    rows.forEach((r) => { lastRingRef.current[r.id] = r.doctor_calling_at ?? null; });
    setConsultas(rows);
    setIsLoadingConsultas(false);
  }, [user]);

  useEffect(() => { loadConsultas(); }, [loadConsultas]);

  // ── Realtime: doctor calling / status changes ─────────────────────────────

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`teleconsultas-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "consultations", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as ConsultaRow;
          setConsultas((prev) =>
            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
          );

          // Doctor is (re)calling: doctor_calling_at bumped on an open consultation
          const prevRing = lastRingRef.current[updated.id] ?? null;
          if (
            updated.status === "in_progress" &&
            updated.doctor_calling_at &&
            updated.doctor_calling_at !== prevRing
          ) {
            lastRingRef.current[updated.id] = updated.doctor_calling_at;
            setRingingConsulta({ id: updated.id, doctorName: updated.doctor_name || "O médico" });
          } else {
            lastRingRef.current[updated.id] = updated.doctor_calling_at ?? prevRing;
          }

          // Dismiss the ring if the consultation closed
          if (updated.status === "completed" || updated.status === "cancelled") {
            setRingingConsulta((r) => (r?.id === updated.id ? null : r));
          }
          if (updated.status === "completed") {
            toast({ title: "Consulta finalizada", description: "Sua teleconsulta foi concluída." });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, toast]);

  // Ring (audio) while the "doctor is calling" modal is open
  useEffect(() => {
    const ringtone = ringtoneRef.current;
    if (ringingConsulta) ringtone.start();
    else ringtone.stop();
    return () => ringtone.stop();
  }, [ringingConsulta]);

  // ── Load credits ──────────────────────────────────────────────────────────

  const loadCredits = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("consultation_credits")
      .select("id, type, amount, expires_at")
      .eq("user_id", user.id)
      .eq("status", "available")
      .eq("type", "clinico_geral")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    setAvailableCredits(data ?? []);
  }, [user]);

  useEffect(() => { loadCredits(); }, [loadCredits]);

  // Auto-start after checkout credit param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const creditParam = params.get("consultation_credit");
    if (!creditParam || pageLoading) return;
    window.history.replaceState({}, "", window.location.pathname);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creditParam);
    toast({ title: "Pagamento confirmado!", description: "Iniciando sua consulta..." });
    setTimeout(() => {
      pendingCreditRef.current = isUUID ? creditParam : null;
      setShowWizardModal(true);
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLoading]);

  // ── Start new consultation ────────────────────────────────────────────────

  const handleStartNewConsultation = () => {
    const active = consultas.filter(c => c.status === "pending" || c.status === "in_progress");
    if (active.length > 0) {
      toast({
        title: "Consulta em andamento",
        description: "Você já possui uma consulta ativa. Conclua ou cancele antes de iniciar uma nova.",
        variant: "destructive",
      });
      return;
    }

    if (hasActivePlan) {
      pendingCreditRef.current = null;
      setShowWizardModal(true);
      return;
    }

    if (availableCredits.length > 0) {
      pendingCreditRef.current = availableCredits[0].id;
      setShowWizardModal(true);
      return;
    }

    setShowStandaloneModal(true);
  };

  const handleUseExistingCredit = (creditId: string) => {
    setShowStandaloneModal(false);
    pendingCreditRef.current = creditId;
    setShowWizardModal(true);
  };

  const handleWizardSubmit = async (intake: WizardIntake, exames: File[]) => {
    if (!user) throw new Error("not authenticated");

    const now = new Date().toISOString();
    const creditId = pendingCreditRef.current;
    pendingCreditRef.current = null;

    // Patient pre-consultation intake (exam URLs filled after upload)
    const intakeData = {
      sintomas: intake.sintomas,
      sintomaPrincipal: intake.sintomaPrincipal,
      medicamentos: intake.medicamentos,
      exames: [] as { name: string; url: string }[],
      submittedAt: now,
    };

    const { data: newConsulta, error } = await supabase
      .from("consultations")
      .insert({
        patient_name: patientName || user.email?.split("@")[0] || "Paciente",
        date: now,
        status: "pending",
        user_id: user.id,
        intake_data: intakeData,
      })
      .select("id")
      .single();

    if (error || !newConsulta) {
      toast({ title: "Erro ao criar consulta", description: "Tente novamente.", variant: "destructive" });
      throw error ?? new Error("insert failed");
    }

    const consultationId = (newConsulta as { id: string }).id;

    // Upload exam files to storage, then patch intake_data with their URLs
    if (exames.length > 0) {
      const uploaded: { name: string; url: string }[] = [];
      for (const file of exames) {
        const safeName = file.name.replace(/[^\w.-]/g, "_");
        const path = `${consultationId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("consulta-exames").upload(path, file);
        if (!upErr) {
          const { data: pub } = supabase.storage.from("consulta-exames").getPublicUrl(path);
          uploaded.push({ name: file.name, url: pub.publicUrl });
        }
      }
      if (uploaded.length > 0) {
        await supabase
          .from("consultations")
          .update({ intake_data: { ...intakeData, exames: uploaded } })
          .eq("id", consultationId);
      }
    }

    if (creditId) {
      await (supabase as any)
        .from("consultation_credits")
        .update({ status: "used", used_at: now, consultation_id: consultationId })
        .eq("id", creditId);
      setAvailableCredits((prev) => prev.filter((c) => c.id !== creditId));
    }

    setShowWizardModal(false);
    navigate(`/sala-espera/${consultationId}`);
  };

  // ── Join existing consultation ────────────────────────────────────────────

  const handleJoinConsulta = (c: ConsultaRow) => {
    navigate(`/consulta/${c.id}/chamada`);
  };

  // ── Cancel consultation ───────────────────────────────────────────────────

  const handleConfirmCancel = async () => {
    if (!cancelConfirmId || !user) return;
    setIsCancellingConsulta(true);
    try {
      const { error: updateError, data: updated } = await supabase
        .from("consultations")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", cancelConfirmId)
        .eq("user_id", user.id)
        .select();

      if (updateError) throw new Error(updateError.message);

      // RLS silently returns 0 rows when policy blocks the update
      if (!updated || updated.length === 0) {
        throw new Error("Sem permissão para cancelar esta consulta.");
      }

      // Update local state immediately without waiting for a reload
      setConsultas((prev) =>
        prev.map((c) => (c.id === cancelConfirmId ? { ...c, status: "cancelled" } : c))
      );

      // Restore credit if applicable
      const { data: restoredCredits } = await (supabase as any)
        .from("consultation_credits")
        .update({ status: "available", consultation_id: null, used_at: null })
        .eq("consultation_id", cancelConfirmId)
        .eq("status", "used")
        .select();

      const hadCredit = restoredCredits && restoredCredits.length > 0;
      if (hadCredit) loadCredits();

      toast({
        title: "Consulta cancelada",
        description: hadCredit
          ? "Consulta cancelada e crédito restaurado."
          : "Consulta cancelada com sucesso.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tente novamente.";
      toast({ title: "Erro ao cancelar", description: msg, variant: "destructive" });
    } finally {
      setIsCancellingConsulta(false);
      setCancelConfirmId(null);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const filteredConsultas = (() => {
    if (consultaFilter === "todos") return consultas;
    const map: Record<ConsultaStatus, string> = {
      AGUARDANDO: "pending", EM_ATENDIMENTO: "in_progress", CONCLUIDO: "completed", CANCELADO: "cancelled",
    };
    return consultas.filter((c) => c.status === map[consultaFilter]);
  })();

  const countByStatus = (s: ConsultaStatus) => {
    const map: Record<ConsultaStatus, string> = {
      AGUARDANDO: "pending", EM_ATENDIMENTO: "in_progress", CONCLUIDO: "completed", CANCELADO: "cancelled",
    };
    return consultas.filter((c) => c.status === map[s]).length;
  };

  const filterTabs: { key: FilterKey; label: string; activeBg: string; ping?: boolean; pulse?: boolean }[] = [
    { key: "todos",          label: "Todos",          activeBg: "bg-gray-800" },
    { key: "AGUARDANDO",     label: "Aguardando",     activeBg: "bg-gradient-to-r from-amber-500 to-orange-500", ping: true },
    { key: "EM_ATENDIMENTO", label: "Em Atendimento", activeBg: "bg-green-500", pulse: true },
    { key: "CONCLUIDO",      label: "Concluídas",     activeBg: "bg-emerald-600" },
    { key: "CANCELADO",      label: "Canceladas",     activeBg: "bg-slate-400" },
  ];

  const isCreating = false; // placeholder — could track async state

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={async () => { await supabase.auth.signOut(); navigate("/auth"); }} />

      <main className="page-container !max-w-4xl">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl gradient-hero text-white shadow-elevated animate-fade-in">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-white/5 blur-xl" aria-hidden />
          <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                Clínico geral disponível agora
              </span>
              <h1 className="mt-3 text-2xl font-bold leading-tight text-white sm:text-3xl">Consulta Imediata</h1>
              <p className="mt-1.5 max-w-md text-sm text-white/85">
                Atendimento com clínico geral, 24 horas por dia, sem agendamento.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/85">
                <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 24h por dia</span>
                <span className="inline-flex items-center gap-1.5"><Video className="h-3.5 w-3.5" /> Por vídeo</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Criptografada</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:w-60">
              {/* Plan / credits status */}
              <div className="rounded-2xl border border-white/20 bg-white/15 px-4 py-3 backdrop-blur-sm">
                {hasActivePlan ? (
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="h-5 w-5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">Plano ativo</p>
                      <p className="text-xs text-white/80">Consultas ilimitadas</p>
                    </div>
                  </div>
                ) : availableCredits.length > 0 ? (
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-bold">
                      {availableCredits.length}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">
                        Consulta{availableCredits.length !== 1 ? "s" : ""} avulsa{availableCredits.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-white/80">Disponível{availableCredits.length !== 1 ? "is" : ""} para usar</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="h-5 w-5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">Sem plano ativo</p>
                      <p className="text-xs text-white/80">Compre avulsa ou assine</p>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleStartNewConsultation}
                disabled={isCreating}
                size="lg"
                className="w-full gap-2 bg-white font-semibold text-primary shadow-lg hover:bg-white/90"
              >
                {isCreating
                  ? <><Loader2 className="h-5 w-5 animate-spin" />Criando...</>
                  : <><Plus className="h-5 w-5" />Nova Consulta</>
                }
              </Button>
            </div>
          </div>
        </section>

        {/* Consultation history */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Minhas Consultas</h2>
              {consultas.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {consultas.length} consulta{consultas.length !== 1 ? "s" : ""} no total
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadConsultas}
              disabled={isLoadingConsultas}
              className="gap-2 text-muted-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingConsultas ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>

          {/* Filter tabs */}
          {!isLoadingConsultas && consultas.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-5">
              {filterTabs.map((tab) => {
                const count = tab.key === "todos" ? consultas.length : countByStatus(tab.key as ConsultaStatus);
                if (tab.key !== "todos" && count === 0) return null;
                const isActive = consultaFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setConsultaFilter(tab.key)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                      isActive
                        ? `${tab.activeBg} text-white shadow-sm`
                        : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                  >
                    {tab.ping && isActive && (
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                      </span>
                    )}
                    {tab.pulse && isActive && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse shrink-0" />}
                    {tab.label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-white/25 text-white" : "bg-foreground/10 text-muted-foreground"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Loading skeletons */}
          {isLoadingConsultas && (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
            </div>
          )}

          {/* Filtered empty state */}
          {!isLoadingConsultas && filteredConsultas.length === 0 && consultas.length > 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma consulta nessa categoria.</p>
              <Button variant="outline" size="sm" onClick={() => setConsultaFilter("todos")}>
                Ver todas
              </Button>
            </div>
          )}

          {/* Zero consultations */}
          {!isLoadingConsultas && consultas.length === 0 && (
            <Card className="border-dashed border-border/70 bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
                  <Video className="h-8 w-8" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Nenhuma consulta ainda</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Inicie seu primeiro atendimento com um clínico geral, sem agendamento.
                  </p>
                </div>
                <Button onClick={handleStartNewConsultation} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Iniciar primeira consulta
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Cards grid */}
          {!isLoadingConsultas && filteredConsultas.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredConsultas.map((c) => (
                <ConsultationHistoryCard
                  key={c.id}
                  consulta={c}
                  onJoin={handleJoinConsulta}
                  onCancel={setCancelConfirmId}
                  onEvaluate={setEvaluatingConsulta}
                  onViewDetails={(con) => navigate(`/consulta/${con.id}/detalhes`)}
                  hasBeenEvaluated={evaluatedIds.has(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Wizard modal */}
      {showWizardModal && (
        <ConsultaWizardModal
          onClose={() => setShowWizardModal(false)}
          onSubmit={handleWizardSubmit}
        />
      )}

      {/* Evaluation modal */}
      {evaluatingConsulta && (
        <EvaluationModal
          consulta={evaluatingConsulta}
          onClose={() => setEvaluatingConsulta(null)}
          onSuccess={(id) => {
            setEvaluatedIds((prev) => new Set([...prev, id]));
            setEvaluatingConsulta(null);
          }}
        />
      )}

      {/* Standalone / no-plan modal */}
      <Dialog open={showStandaloneModal} onOpenChange={(open) => { if (!open) setShowStandaloneModal(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Consulta Avulsa
            </DialogTitle>
            <DialogDescription>
              {availableCredits.length > 0
                ? "Você tem créditos disponíveis! Use um abaixo ou compre uma nova consulta."
                : "Pague uma consulta avulsa para ser atendido por um clínico geral"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Existing credits */}
            {availableCredits.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Seus créditos disponíveis:</p>
                {availableCredits.map((credit) => (
                  <Card
                    key={credit.id}
                    className="cursor-pointer transition-all border-green-200 bg-green-50 hover:border-green-400 hover:shadow-md"
                    onClick={() => handleUseExistingCredit(credit.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium text-green-800">Clínico Geral</p>
                            <p className="text-xs text-green-600">
                              Válido até {format(new Date(credit.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">Usar agora</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground text-center mb-3">Ou compre uma nova consulta:</p>
                </div>
              </div>
            )}

            {/* Buy option */}
            <Card
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
              onClick={() => navigate("/checkout/consultation?type=clinico_geral")}
            >
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Stethoscope className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Consulta Avulsa — Clínico Geral</h3>
                  <p className="text-sm text-muted-foreground mt-1">Consulta pontual, sem compromisso.</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-primary">R$ 59,90</p>
                  <p className="text-xs text-muted-foreground">por consulta</p>
                </div>
              </CardContent>
            </Card>

            {/* Plan CTA */}
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground text-center mb-3">
                Ou assine um plano para consultas ilimitadas com clínico geral
              </p>
              <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/planos")}>
                <CreditCard className="h-4 w-4" />
                Ver planos disponíveis
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm dialog */}
      <Dialog open={cancelConfirmId !== null} onOpenChange={(open) => { if (!open) setCancelConfirmId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar consulta?</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar? Se você usou um crédito avulso, ele será restaurado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelConfirmId(null)} disabled={isCancellingConsulta}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel} disabled={isCancellingConsulta} className="gap-2">
              {isCancellingConsulta ? <><Loader2 className="h-4 w-4 animate-spin" />Cancelando...</> : "Cancelar consulta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* "Doctor is calling" ring */}
      <Dialog open={!!ringingConsulta} onOpenChange={(open) => { if (!open) setRingingConsulta(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-3 text-center">
              <span className="relative flex h-16 w-16">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex h-16 w-16 rounded-full bg-green-500 items-center justify-center">
                  <PhoneCall className="h-7 w-7 text-white" />
                </span>
              </span>
              O médico está chamando
            </DialogTitle>
            <DialogDescription className="text-center">
              {ringingConsulta?.doctorName} está pronto para retomar sua consulta. Entre na chamada agora.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              size="lg"
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => {
                const cid = ringingConsulta?.id;
                setRingingConsulta(null);
                if (cid) navigate(`/consulta/${cid}/chamada`);
              }}
            >
              <Video className="h-5 w-5" /> Entrar na chamada
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setRingingConsulta(null)}>
              Agora não
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Teleconsultas;
