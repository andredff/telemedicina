import { useEffect, useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Video, Stethoscope, FileText, FlaskConical, Pill, Crown,
  ChevronRight, ArrowRight, Clock, Package, ClipboardCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RBAC } from "@/integrations/supabase/adminClient";
import { logger } from "@/lib/logger";
import type { ConsultaDraft } from "@/lib/consultaDraft";
import { isActive, isInCall, patientStageLabel } from "@/lib/consultationStatus";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SupportFAB from "@/components/SupportFAB";

// Rótulo + cor por status da consulta (usado no histórico).
const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  pending:     { label: "Na fila",       dot: "bg-amber-500",   text: "text-amber-600" },
  in_progress: { label: "Em andamento",  dot: "bg-blue-500",    text: "text-blue-600" },
  completed:   { label: "Realizada",     dot: "bg-emerald-500", text: "text-emerald-600" },
  cancelled:   { label: "Cancelada",     dot: "bg-slate-400",   text: "text-slate-500" },
};

interface ConsultaRow {
  id: string;
  status: string;
  doctor_name: string | null;
  created_at: string;
  date: string;
  clinical_data?: ConsultaDraft | null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("Paciente");
  const [consultas, setConsultas] = useState<ConsultaRow[]>([]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
      const { data: userData } = await supabase.auth.getUser();
      setFullName((data?.full_name as string) || (userData?.user?.user_metadata?.full_name as string) || userData?.user?.email?.split("@")[0] || "Paciente");
    } catch (error) {
      logger.error("Error fetching profile:", error);
    }
  };

  const fetchConsultas = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("consultations")
        .select("id, status, doctor_name, created_at, date, clinical_data")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      setConsultas((data as unknown as ConsultaRow[]) ?? []);
    } catch (error) {
      logger.error("Error fetching consultations:", error);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else if (session.user) {
        fetchProfile(session.user.id);
        fetchConsultas(session.user.id);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else if (session.user) {
        const role = await RBAC.getUserRole(session.user.id);
        if (role === RBAC.ROLES.DOCTOR) { navigate("/medico"); return; }
        if (role === RBAC.ROLES.ADMIN) { navigate("/admin"); return; }
        fetchProfile(session.user.id);
        fetchConsultas(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const firstName = (fullName || user?.user_metadata?.full_name || "Paciente").split(" ")[0];

  // ── Derived data ────────────────────────────────────────────────────────────
  const hasDoc = (c: ConsultaRow, k: "medications" | "examRequests") => (c.clinical_data?.[k]?.length ?? 0) > 0;
  const activeConsulta = consultas.find(c => isActive(c.status)) ?? null;
  const completedCount = consultas.filter(c => c.status === "completed").length;
  const receitasCount = consultas.filter(c => c.status === "completed" && hasDoc(c, "medications")).length;
  const examesCount = consultas.filter(c => c.status === "completed" && hasDoc(c, "examRequests")).length;

  const recentDocs = consultas
    .filter(c => c.status === "completed" && c.clinical_data &&
      (hasDoc(c, "medications") || hasDoc(c, "examRequests") || !!c.clinical_data.certificate))
    .slice(0, 3);

  const docChips = (c: ConsultaRow): { icon: ElementType; label: string }[] => {
    const chips: { icon: ElementType; label: string }[] = [];
    if (hasDoc(c, "medications")) chips.push({ icon: FileText, label: "Receita" });
    if (hasDoc(c, "examRequests")) chips.push({ icon: FlaskConical, label: "Exames" });
    if (c.clinical_data?.certificate) chips.push({ icon: ClipboardCheck, label: "Atestado" });
    return chips;
  };

  const goToActive = () => {
    if (!activeConsulta) return;
    navigate(isInCall(activeConsulta.status)
      ? `/consulta/${activeConsulta.id}/chamada`
      : `/consulta/${activeConsulta.id}/preparacao`);
  };

  // ── Histórico de consultas (coluna direita) ─────────────────────────────────
  const recentConsultas = consultas.slice(0, 4);
  const openConsulta = (c: ConsultaRow) => {
    if (isInCall(c.status)) navigate(`/consulta/${c.id}/chamada`);
    else if (isActive(c.status)) navigate(`/consulta/${c.id}/preparacao`);
    else navigate(`/consulta/${c.id}/detalhes`);
  };

  const kpis: { label: string; value: string | number; hint: string; icon: ElementType; tint: string }[] = [
    {
      label: "Próxima consulta",
      value: activeConsulta ? (isInCall(activeConsulta.status) ? "Agora" : "Na fila") : "—",
      hint: activeConsulta ? "Toque para entrar" : "Nenhuma agendada",
      icon: Video, tint: "bg-amber-50 text-amber-700",
    },
    { label: "Consultas realizadas", value: completedCount, hint: "No seu histórico", icon: Stethoscope, tint: "bg-emerald-50 text-emerald-600" },
    { label: "Receitas digitais", value: receitasCount, hint: "Disponíveis", icon: FileText, tint: "bg-amber-50 text-amber-700" },
    { label: "Exames", value: examesCount, hint: "Solicitados", icon: FlaskConical, tint: "bg-emerald-50 text-emerald-600" },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{getGreeting()}, {firstName}</h1>
        <p className="mt-1 text-slate-500">Aqui está um resumo da sua saúde e atendimentos.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, hint, icon: Icon, tint }) => (
          <div key={label} className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-md sm:p-5">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-sm font-medium text-slate-700">{label}</p>
            <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">

          {/* Next consultation / Entrar na consulta */}
          <div className="relative overflow-hidden rounded-3xl gradient-hero p-6 text-white shadow-lg sm:p-7">
            <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-12 left-12 h-32 w-32 rounded-full bg-white/10 blur-xl" aria-hidden />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  {activeConsulta && isInCall(activeConsulta.status) ? <Video className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/85">
                    {activeConsulta ? patientStageLabel(activeConsulta.status) : "Consulta imediata"}
                  </p>
                  <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                    {activeConsulta
                      ? (isInCall(activeConsulta.status) ? "O médico está te esperando" : "Sua consulta vai começar")
                      : "Fale com um clínico agora"}
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-white/90">
                    {activeConsulta
                      ? (isInCall(activeConsulta.status)
                          ? `${activeConsulta.doctor_name || "O médico"} já está na sala de atendimento.`
                          : "Um atendente confirma seus dados e te encaminha ao médico. Vamos verificar câmera e microfone enquanto isso.")
                      : "Atendimento com clínico geral, 24h por dia, sem agendar."}
                  </p>
                </div>
              </div>
              <Button
                onClick={activeConsulta ? goToActive : () => navigate("/teleconsultas")}
                className="h-14 w-full gap-2 rounded-2xl bg-white text-base font-semibold text-amber-700 shadow-md hover:bg-amber-50 sm:w-auto sm:px-7"
              >
                <Video className="h-5 w-5" />
                {activeConsulta ? "Entrar na Consulta" : "Iniciar consulta"}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Recent documents */}
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur-md sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Documentos recentes</h2>
                <p className="text-xs text-slate-500">Receitas, exames e atestados</p>
              </div>
              <Button variant="ghost" size="sm" className="gap-1 text-amber-700 hover:text-amber-800" onClick={() => navigate("/teleconsultas")}>
                Ver todos <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {recentDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <FileText className="h-6 w-6 text-slate-400" />
                </div>
                <p className="max-w-xs text-sm text-slate-500">Seus documentos aparecerão aqui após as consultas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDocs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/consulta/${c.id}/detalhes`)}
                    className="flex min-h-[68px] w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left transition-colors hover:border-amber-200 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">Consulta · Clínico Geral</p>
                      <p className="text-xs text-slate-400">{format(new Date(c.created_at || c.date), "dd/MM/yyyy", { locale: ptBR })}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {docChips(c).map((d) => (
                          <span key={d.label} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            <d.icon className="h-3 w-3" /> {d.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Consultation history */}
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Histórico de consultas</h2>
                <p className="text-xs text-slate-500">Seus últimos atendimentos</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-amber-700 hover:text-amber-800" onClick={() => navigate("/teleconsultas")}>
                Ver todas <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {recentConsultas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                  <Stethoscope className="h-5 w-5 text-slate-400" />
                </div>
                <p className="max-w-[14rem] text-sm text-slate-500">Suas consultas aparecerão aqui após o primeiro atendimento.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentConsultas.map((c) => {
                  const meta = STATUS_META[c.status] ?? STATUS_META.completed;
                  return (
                    <button
                      key={c.id}
                      onClick={() => openConsulta(c)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition-colors hover:border-amber-200 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{c.doctor_name || "Clínico Geral"}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-xs text-slate-400">{format(new Date(c.created_at || c.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${meta.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="rounded-3xl border border-white/60 bg-white/80 p-3 shadow-sm backdrop-blur-md">
            {[
              { label: "Meus pedidos", icon: Package, route: "/orders" },
              { label: "Farmácia", icon: Pill, route: "/farmacia" },
              { label: "Meu plano", icon: Crown, route: "/meu-plano" },
            ].map(({ label, icon: Icon, route }) => (
              <button
                key={route}
                onClick={() => navigate(route)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                <Icon className="h-[18px] w-[18px] text-slate-400" />
                <span className="flex-1 text-left">{label}</span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <SupportFAB />
    </div>
  );
};

export default Dashboard;
