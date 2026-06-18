import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FlaskConical, Search, User, HeartPulse, CheckCircle2, AlertCircle, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { ALL_PLANS } from "@/data/plansData";

interface PatientResult {
  user_id: string;
  full_name: string;
  cpf: string;
  subscription_id: string | null;
  plan_name: string | null;
  plan_type: string | null;
  billing_cycle: "monthly" | "yearly";
  total_checkups: number;
  used_checkups: number;
  available_checkups: number;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");
const maskCpf = (s: string) => {
  const d = onlyDigits(s).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const LabPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [labUserName, setLabUserName] = useState<string>("");
  const [labName, setLabName] = useState("");
  const [cpf, setCpf] = useState("");
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<PatientResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "lab") {
        toast({
          title: "Acesso negado",
          description: "Este painel é exclusivo para laboratórios parceiros.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }
      setLabUserName(profile?.full_name || "Laboratório");
      setAuthorized(true);
    };
    check();
  }, [navigate, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const searchPatient = async () => {
    setNotFound(false);
    setPatient(null);

    const cpfDigits = onlyDigits(cpf);
    if (cpfDigits.length !== 11) {
      toast({
        title: "CPF inválido",
        description: "Digite os 11 dígitos do CPF do paciente.",
        variant: "destructive",
      });
      return;
    }
    if (!labName.trim()) {
      toast({
        title: "Informe o laboratório",
        description: "Preencha o nome do laboratório responsável antes de buscar.",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    try {
      const cpfMasked = cpfDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name, cpf")
        .in("cpf", [cpfDigits, cpfMasked])
        .limit(1);

      if (profileErr) logger.error("Profile search error:", profileErr);

      const profile = profiles?.[0];
      if (!profile) {
        setNotFound(true);
        return;
      }

      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select(`
          id,
          billing_cycle,
          plan:subscription_plans ( name, type )
        `)
        .eq("user_id", profile.id)
        .eq("status", "active")
        .maybeSingle();

      let used = 0;
      try {
        const { count } = await supabase
          .from("checkup_usages" as never)
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id);
        used = count || 0;
      } catch {
        used = 0;
      }

      const planType = (sub?.plan as { type?: string } | null)?.type ?? null;
      const planName = (sub?.plan as { name?: string } | null)?.name ?? null;
      const planData = planType ? ALL_PLANS.find((p) => p.type === planType) : null;
      // Ciclo do plano é sempre anual — saldo de check-ups é o do ciclo anual.
      const total = planData ? planData.checkups_per_year : 0;

      setPatient({
        user_id: profile.id,
        full_name: profile.full_name,
        cpf: profile.cpf,
        subscription_id: sub?.id ?? null,
        plan_name: planName,
        plan_type: planType,
        billing_cycle: sub?.billing_cycle === "yearly" ? "yearly" : "monthly",
        total_checkups: total,
        used_checkups: used,
        available_checkups: Math.max(0, total - used),
      });
    } catch (e) {
      logger.error("Search error:", e);
      toast({
        title: "Erro na busca",
        description: "Não foi possível buscar o paciente. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const registerCheckup = async () => {
    if (!patient) return;
    setRegistering(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("checkup_usages" as never)
        .insert({
          user_id: patient.user_id,
          subscription_id: patient.subscription_id,
          lab_name: labName.trim(),
          performed_by: user?.id,
          performed_by_name: labUserName,
          plan_type: patient.plan_type,
          billing_cycle: patient.billing_cycle,
          performed_at: new Date().toISOString(),
        } as never);

      if (error) {
        if (error.message?.toLowerCase().includes("checkup_usages")) {
          toast({
            title: "Tabela não criada",
            description: "A tabela checkup_usages ainda não foi criada no banco. Rode a migration antes de registrar check-ups.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Check-up registrado",
        description: `Check-up realizado para ${patient.full_name}.`,
      });
      setConfirmOpen(false);
      setPatient({
        ...patient,
        used_checkups: patient.used_checkups + 1,
        available_checkups: Math.max(0, patient.available_checkups - 1),
      });
    } catch (e) {
      logger.error("Register checkup error:", e);
      toast({
        title: "Erro ao registrar",
        description: "Não foi possível registrar o check-up.",
        variant: "destructive",
      });
    } finally {
      setRegistering(false);
    }
  };

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated minimal onLogout={handleLogout} />
      <main className="page-container">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-primary">
                Painel do Laboratório
              </h1>
              <p className="text-muted-foreground text-sm">
                Valide e registre check-ups dos beneficiários Novità
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buscar paciente</CardTitle>
            <CardDescription>
              Preencha o laboratório responsável e o CPF do beneficiário para validar o check-up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="lab-name">Laboratório responsável</Label>
              <Input
                id="lab-name"
                placeholder="Ex.: Laboratório Central - Unidade Centro"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cpf">CPF do paciente</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  inputMode="numeric"
                  onKeyDown={(e) => e.key === "Enter" && searchPatient()}
                />
                <Button onClick={searchPatient} disabled={searching} className="gap-2">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {notFound && (
          <Card className="mt-4 border-destructive/30 bg-destructive/5">
            <CardContent className="p-5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Paciente não encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Não localizamos nenhum beneficiário com este CPF. Confirme o número e tente novamente.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {patient && (
          <Card className="mt-4">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Paciente</p>
                  <p className="font-semibold text-lg">{patient.full_name}</p>
                  <p className="text-sm text-muted-foreground">CPF: {maskCpf(onlyDigits(patient.cpf))}</p>
                </div>
              </div>

              {patient.plan_name ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Plano</p>
                    <p className="font-semibold">{patient.plan_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Anual</p>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Realizados</p>
                    <p className="font-semibold text-lg">{patient.used_checkups}</p>
                  </div>
                  <div
                    className={`rounded-xl p-4 border ${
                      patient.available_checkups > 0
                        ? "bg-rose-500/5 border-rose-500/20"
                        : "bg-muted border-border"
                    }`}
                  >
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Disponível</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{patient.available_checkups}</span>
                      <span className="text-sm text-muted-foreground">de {patient.total_checkups}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Sem plano ativo</p>
                    <p className="text-sm text-muted-foreground">
                      Este beneficiário não possui plano ativo. Check-up não pode ser realizado.
                    </p>
                  </div>
                </div>
              )}

              {patient.plan_name && patient.total_checkups === 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    O plano <strong>{patient.plan_name}</strong> não inclui check-ups.
                  </p>
                </div>
              )}

              <Button
                size="lg"
                className="w-full gap-2"
                disabled={patient.available_checkups <= 0}
                onClick={() => setConfirmOpen(true)}
              >
                <HeartPulse className="h-5 w-5" />
                {patient.available_checkups > 0 ? "Realizar check-up" : "Sem check-ups disponíveis"}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar check-up</AlertDialogTitle>
            <AlertDialogDescription>
              Você está registrando um check-up para <strong>{patient?.full_name}</strong> no
              laboratório <strong>{labName}</strong>. Esta ação subtrai 1 do saldo do paciente
              e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={registering}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={registerCheckup} disabled={registering}>
              {registering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Registrando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LabPanel;
