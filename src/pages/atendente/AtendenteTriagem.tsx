import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { logEvent } from '@/lib/audit';
import type { IntakeData } from '@/lib/consultaDraft';
import { openExamFile } from '@/lib/examFiles';
import { DoctorVideoPanel } from '@/components/medico/DoctorVideoPanel';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users, Clock, RefreshCw, LogOut, HeadphonesIcon, Send, X, Video,
  Phone, IdCard, Stethoscope, AlertCircle, ChevronRight, FileText,
} from 'lucide-react';

// ─── Types (mirror the triage_queue view) ──────────────────────────────────────

interface TriageRow {
  id: string;
  number: number | null;
  status: string;
  priority: 'normal' | 'priority' | 'urgent';
  specialty: string | null;
  type: string | null;
  patient_name: string;
  created_at: string;
  triage_at: string | null;
  routed_at: string | null;
  attendant_id: string | null;
  attendant_name: string | null;
  intake_data: IntakeData | null;
  triage_data: { orientacao?: string } | null;
  patient_phone: string | null;
  patient_cpf: string | null;
  patient_birth_date: string | null;
  patient_gender: string | null;
}

const SPECIALTIES = [
  { value: 'clinico_geral', label: 'Clínico geral' },
  { value: 'pediatria', label: 'Pediatria' },
  { value: 'dermatologia', label: 'Dermatologia' },
  { value: 'ginecologia', label: 'Ginecologia' },
  { value: 'psiquiatria', label: 'Psiquiatria' },
  { value: 'cardiologia', label: 'Cardiologia' },
];

const PRIORITIES: { value: TriageRow['priority']; label: string; cls: string }[] = [
  { value: 'normal',   label: 'Normal',      cls: 'border-slate-300 text-slate-700 data-[on=true]:bg-slate-600 data-[on=true]:text-white data-[on=true]:border-slate-600' },
  { value: 'priority', label: 'Prioritário', cls: 'border-amber-300 text-amber-700 data-[on=true]:bg-amber-500 data-[on=true]:text-white data-[on=true]:border-amber-500' },
  { value: 'urgent',   label: 'Urgente',     cls: 'border-red-300 text-red-700 data-[on=true]:bg-red-600 data-[on=true]:text-white data-[on=true]:border-red-600' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

function elapsed(iso: string): string {
  try { return formatDistanceToNow(new Date(iso), { locale: ptBR, addSuffix: false }); }
  catch { return '—'; }
}

function ageFrom(birth?: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

function complaint(intake?: IntakeData | null): string {
  if (!intake) return 'Sem queixa informada pelo paciente.';
  if (intake.sintomaPrincipal?.trim()) return intake.sintomaPrincipal.trim();
  if (intake.descricao?.trim()) return intake.descricao.trim();
  if (intake.sintomas?.length) return intake.sintomas.join(', ');
  return 'Sem queixa informada pelo paciente.';
}

function initials(name: string): string {
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AtendenteTriagem() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [authChecked, setAuthChecked] = useState(false);
  const [attendantName, setAttendantName] = useState('');
  const [rows, setRows] = useState<TriageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inCall, setInCall] = useState(false);

  // Triage form state (kept separate so polling never clobbers in-progress edits)
  const [priority, setPriority] = useState<TriageRow['priority']>('normal');
  const [specialty, setSpecialty] = useState('clinico_geral');
  const [orientacao, setOrientacao] = useState('');

  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  // ── Auth: attendant or admin only ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: profile } = await supabase
        .from('profiles').select('full_name, role').eq('id', user.id).single();
      const role = (profile as { role?: string } | null)?.role;
      if (role !== 'attendant' && role !== 'admin') { navigate('/dashboard'); return; }
      setAttendantName((profile as { full_name?: string } | null)?.full_name ?? 'Atendente');
      setAuthChecked(true);
    })();
  }, [navigate]);

  // ── Load the triage queue (polling — attendants have no table SELECT, so
  //    Realtime/postgres_changes is intentionally unavailable to them) ─────────
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('triage_queue')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error) setRows((data ?? []) as unknown as TriageRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    load();
    const poll = setInterval(load, 4000);
    return () => clearInterval(poll);
  }, [authChecked, load]);

  // ── Derived buckets ─────────────────────────────────────────────────────────
  const waiting = useMemo(
    () => rows.filter(r => r.status === 'waiting_attendant'),
    [rows],
  );
  const doctorQueueDepth = useMemo(
    () => rows.filter(r => r.status === 'waiting_doctor' || r.status === 'routed_to_doctor').length,
    [rows],
  );
  const selected = useMemo(
    () => rows.find(r => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  // If the selected patient leaves the triage stage (e.g. routed elsewhere), clear it.
  useEffect(() => {
    if (selectedId && !rows.some(r => r.id === selectedId)) setSelectedId(null);
  }, [rows, selectedId]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  // Selecting a queued patient == starting triage (no extra "iniciar" button).
  const handleSelect = async (row: TriageRow) => {
    if (busy) return;
    if (row.id !== selectedId) setInCall(false); // don't carry a call across patients
    // Seed the form from any existing triage data.
    setPriority(row.priority ?? 'normal');
    setSpecialty(row.specialty ?? row.type ?? 'clinico_geral');
    setOrientacao(row.triage_data?.orientacao ?? '');

    if (row.status === 'waiting_attendant') {
      setBusy(true);
      const { data, error } = await supabase.rpc('triage_claim', { p_consultation_id: row.id });
      setBusy(false);
      if (error) {
        toast({ title: 'Paciente já está em atendimento por outro atendente.', variant: 'destructive' });
        load();
        return;
      }
      const claimed = (data as unknown as TriageRow[])?.[0];
      if (claimed) {
        setRows(prev => prev.map(r => (r.id === claimed.id ? claimed : r)));
        logEvent('triage_claimed', { consultationId: row.id });
      }
    }
    setSelectedId(row.id);
  };

  // Start a video call with the patient during first contact. Reuses the
  // doctor_calling_at signal (via triage_ring) so the patient is rung into the
  // room, then opens the shared video panel on this consultation's channel.
  const handleStartCall = async () => {
    if (!selected) return;
    const { error } = await supabase.rpc('triage_ring', { p_consultation_id: selected.id });
    if (error) {
      toast({ title: 'Não foi possível chamar o paciente', description: error.message, variant: 'destructive' });
      return;
    }
    logEvent('triage_call_started', { consultationId: selected.id });
    setInCall(true);
  };

  const handleRoute = async () => {
    if (!selected || busy) return;
    setInCall(false);
    setBusy(true);
    const { error } = await supabase.rpc('triage_route', {
      p_consultation_id: selected.id,
      p_priority: priority,
      p_specialty: specialty,
      p_triage_data: { orientacao: orientacao.trim() || null },
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Não foi possível encaminhar', description: error.message, variant: 'destructive' });
      return;
    }
    logEvent('triage_routed', {
      consultationId: selected.id,
      payload: { priority, specialty },
    });
    toast({ title: 'Encaminhado ao médico', description: `${selected.patient_name} entrou na fila médica.` });
    setSelectedId(null);
    load();
  };

  const handleCancel = async () => {
    if (!selected || busy) return;
    setInCall(false);
    setBusy(true);
    const { error } = await supabase.rpc('triage_cancel', {
      p_consultation_id: selected.id,
      p_reason: 'Cancelada na triagem',
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Não foi possível cancelar', description: error.message, variant: 'destructive' });
      return;
    }
    logEvent('triage_cancelled', { consultationId: selected.id });
    toast({ title: 'Consulta cancelada' });
    setSelectedId(null);
    load();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Top bar */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <HeadphonesIcon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-none">Triagem · Novità</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">Atendente: {attendantName}</p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Stethoscope className="h-3.5 w-3.5" />
            <span>{doctorQueueDepth} na fila médica</span>
          </div>
          <Button variant="ghost" size="sm" className="text-gray-500 h-8 text-xs" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sair
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">

        {/* ── Queue ── */}
        <aside className="lg:w-80 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-foreground">
                {waiting.length} aguardando
              </span>
            </div>
            <button onClick={load} className="text-gray-400 hover:text-gray-600" aria-label="Atualizar fila">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Carregando fila…</p>
            ) : waiting.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhum paciente aguardando</p>
                <p className="text-xs text-muted-foreground mt-1">A fila atualiza automaticamente.</p>
              </div>
            ) : (
              <ul>
                {waiting.map((r, i) => {
                  const active = r.id === selectedId;
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => handleSelect(r)}
                        disabled={busy}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 flex items-start gap-3 transition-colors
                          ${active ? 'bg-primary/5' : 'hover:bg-gray-50'} ${i === 0 ? 'bg-amber-50/60' : ''}`}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          {initials(r.patient_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{r.patient_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{complaint(r.intake_data)}</p>
                          <p className="text-[11px] text-muted-foreground/80 mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {elapsed(r.created_at)}
                            {r.number ? <span className="ml-1">· #{r.number}</span> : null}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 mt-1" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Detail / triage ── */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {!selected ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-xs">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <HeadphonesIcon className="h-7 w-7 text-slate-400" />
                </div>
                <p className="font-semibold text-foreground mb-1">Selecione um paciente</p>
                <p className="text-sm text-muted-foreground">
                  Ao abrir um paciente da fila, você inicia o primeiro contato e confirma os dados antes de encaminhar ao médico.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-5">

              {/* Patient header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">
                  {initials(selected.patient_name)}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground leading-tight">{selected.patient_name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {[
                      ageFrom(selected.patient_birth_date) != null ? `${ageFrom(selected.patient_birth_date)} anos` : null,
                      selected.patient_gender,
                    ].filter(Boolean).join(' · ') || 'Dados do paciente'}
                  </p>
                </div>
              </div>

              {/* Contact (confirm basic data) */}
              <Card>
                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-foreground">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    {selected.patient_phone || <span className="text-muted-foreground">Telefone não informado</span>}
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
                    {selected.patient_cpf || <span className="text-muted-foreground">CPF não informado</span>}
                  </div>
                </CardContent>
              </Card>

              {/* Chief complaint (read-only, patient-authored) */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Motivo informado pelo paciente
                </p>
                <div className="rounded-xl border border-gray-200 bg-white p-3.5 text-sm text-foreground">
                  {complaint(selected.intake_data)}
                  {selected.intake_data && (
                    <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {selected.intake_data.duracao && <span>Duração: {selected.intake_data.duracao}</span>}
                      {selected.intake_data.intensidade != null && <span>Intensidade: {selected.intake_data.intensidade}/10</span>}
                      {selected.intake_data.alergias?.trim() && <span>Alergias: {selected.intake_data.alergias}</span>}
                      {selected.intake_data.medicamentos?.trim() && <span>Medicamentos: {selected.intake_data.medicamentos}</span>}
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Histórico clínico e prescrições são visíveis apenas ao médico.
                </p>
              </div>

              {/* Documentos anexados pelo paciente — abrem via signed URL (bucket privado) */}
              {selected.intake_data?.exames?.length ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Documentos anexados pelo paciente
                  </p>
                  <div className="space-y-1.5">
                    {selected.intake_data.exames.map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => openExamFile(ex)}
                        className="flex w-full items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm text-foreground text-left"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{ex.name}</span>
                        <span className="text-xs text-primary shrink-0">Abrir</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Priority */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Prioridade</p>
                <div className="flex gap-2">
                  {PRIORITIES.map(p => (
                    <button
                      key={p.value}
                      data-on={priority === p.value}
                      onClick={() => setPriority(p.value)}
                      className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${p.cls}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specialty */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Especialidade</label>
                <select
                  value={specialty}
                  onChange={e => setSpecialty(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* Orientation note for the doctor */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Orientação inicial <span className="font-normal normal-case text-muted-foreground/70">(opcional, visível ao médico)</span>
                </label>
                <textarea
                  value={orientacao}
                  onChange={e => setOrientacao(e.target.value)}
                  rows={3}
                  placeholder="Ex.: Paciente já tem exame anexado; relata febre há 2 dias."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <Button
                  onClick={handleStartCall}
                  disabled={busy || inCall}
                  variant="outline"
                  className="w-full gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Video className="h-4 w-4" />
                  {inCall ? 'Em chamada com o paciente…' : 'Iniciar chamada com o paciente'}
                </Button>
                <div className="flex items-center gap-3">
                  <Button onClick={handleRoute} disabled={busy} className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white">
                    <Send className="h-4 w-4" /> Encaminhar ao médico
                  </Button>
                  <Button onClick={handleCancel} disabled={busy} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-2">
                    <X className="h-4 w-4" /> Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating video panel — reuses the doctor's WebRTC panel on this
          consultation's channel (intake is triage-safe; no clinical_data). */}
      {inCall && selected && (
        <DoctorVideoPanel
          consultationId={selected.id}
          patientName={selected.patient_name}
          intake={selected.intake_data}
          onCallEnded={() => setInCall(false)}
        />
      )}
    </div>
  );
}
