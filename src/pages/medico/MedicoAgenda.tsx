import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Clock, Plus, Trash2, Loader2, CalendarDays, Info,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeSlot {
  id: string;
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  slots: TimeSlot[];
}

type DayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

interface WeeklySchedule {
  duration: number;
  days: Record<DayKey, DaySchedule>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'seg', label: 'Segunda-feira', short: 'Seg' },
  { key: 'ter', label: 'Terça-feira', short: 'Ter' },
  { key: 'qua', label: 'Quarta-feira', short: 'Qua' },
  { key: 'qui', label: 'Quinta-feira', short: 'Qui' },
  { key: 'sex', label: 'Sexta-feira', short: 'Sex' },
  { key: 'sab', label: 'Sábado', short: 'Sáb' },
  { key: 'dom', label: 'Domingo', short: 'Dom' },
];

const DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeDefaultSchedule(): WeeklySchedule {
  return {
    duration: 30,
    days: {
      seg: { enabled: true, slots: [{ id: makeId(), start: '08:00', end: '12:00' }, { id: makeId(), start: '14:00', end: '18:00' }] },
      ter: { enabled: true, slots: [{ id: makeId(), start: '08:00', end: '12:00' }, { id: makeId(), start: '14:00', end: '18:00' }] },
      qua: { enabled: true, slots: [{ id: makeId(), start: '08:00', end: '12:00' }, { id: makeId(), start: '14:00', end: '18:00' }] },
      qui: { enabled: true, slots: [{ id: makeId(), start: '08:00', end: '12:00' }, { id: makeId(), start: '14:00', end: '18:00' }] },
      sex: { enabled: true, slots: [{ id: makeId(), start: '08:00', end: '12:00' }] },
      sab: { enabled: false, slots: [] },
      dom: { enabled: false, slots: [] },
    },
  };
}

// ─── Slot count helper ────────────────────────────────────────────────────────

function countSlots(slots: TimeSlot[], duration: number): number {
  return slots.reduce((acc, s) => {
    const [sh, sm] = s.start.split(':').map(Number);
    const [eh, em] = s.end.split(':').map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    return acc + Math.floor(minutes / duration);
  }, 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MedicoAgenda() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<WeeklySchedule>(makeDefaultSchedule());

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const stored = user.user_metadata?.availability_schedule as WeeklySchedule | undefined;
        if (stored?.days) {
          // Merge with default to ensure all keys exist
          const merged = makeDefaultSchedule();
          merged.duration = stored.duration ?? 30;
          for (const key of Object.keys(merged.days) as DayKey[]) {
            if (stored.days[key]) {
              merged.days[key] = stored.days[key];
            }
          }
          setSchedule(merged);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Mutators ─────────────────────────────────────────────────────────────────

  const setDay = (key: DayKey, patch: Partial<DaySchedule>) => {
    setSchedule(prev => ({
      ...prev,
      days: { ...prev.days, [key]: { ...prev.days[key], ...patch } },
    }));
  };

  const addSlot = (key: DayKey) => {
    const last = schedule.days[key].slots.at(-1);
    const start = last ? last.end : '09:00';
    const [h, m] = start.split(':').map(Number);
    const endMin = h * 60 + m + 60;
    const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    setDay(key, {
      slots: [...schedule.days[key].slots, { id: makeId(), start, end: endMin >= 1440 ? '23:00' : end }],
    });
  };

  const removeSlot = (key: DayKey, id: string) => {
    setDay(key, { slots: schedule.days[key].slots.filter(s => s.id !== id) });
  };

  const updateSlot = (key: DayKey, id: string, field: 'start' | 'end', value: string) => {
    setDay(key, {
      slots: schedule.days[key].slots.map(s => s.id === id ? { ...s, [field]: value } : s),
    });
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const save = async () => {
    // Validate: end must be after start
    for (const { key, label } of DAYS) {
      for (const slot of schedule.days[key].slots) {
        if (slot.start >= slot.end) {
          toast({
            title: 'Horário inválido',
            description: `${label}: horário de término deve ser após o início.`,
            variant: 'destructive',
          });
          return;
        }
      }
    }
    setSaving(true);
    try {
      await supabase.auth.updateUser({
        data: { availability_schedule: schedule },
      });
      toast({ title: 'Agenda salva!', description: 'Seus horários foram atualizados.' });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Total stats ───────────────────────────────────────────────────────────────

  const activeDays = DAYS.filter(d => schedule.days[d.key].enabled).length;
  const totalWeeklySlots = DAYS.reduce((acc, d) => {
    if (!schedule.days[d.key].enabled) return acc;
    return acc + countSlots(schedule.days[d.key].slots, schedule.duration);
  }, 0);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Agenda de Atendimento</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure os horários disponíveis para consultas com especialista
        </p>
      </div>

      {/* ── Stats summary ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Dias ativos', value: String(activeDays), icon: CalendarDays, color: 'text-primary bg-primary/10' },
          { label: 'Consultas/semana', value: String(totalWeeklySlots), icon: Clock, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Duração', value: `${schedule.duration} min`, icon: Clock, color: 'text-violet-600 bg-violet-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Duration setting ── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Duração da Consulta</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define o intervalo entre cada agendamento
                </p>
              </div>
            </div>
            <Select
              value={String(schedule.duration)}
              onValueChange={v => setSchedule(prev => ({ ...prev, duration: Number(v) }))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map(d => (
                  <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Weekly schedule ── */}
      <Card>
        <CardHeader className="pb-0 px-5 pt-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <p className="font-semibold text-sm text-foreground">Horários por Dia da Semana</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ative os dias e defina os blocos de horário disponíveis
          </p>
        </CardHeader>
        <CardContent className="p-5 space-y-0">
          {DAYS.map(({ key, label, short }, idx) => {
            const day = schedule.days[key];
            const slotCount = day.enabled ? countSlots(day.slots, schedule.duration) : 0;

            return (
              <div
                key={key}
                className={`py-4 ${idx < DAYS.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={day.enabled}
                      onCheckedChange={v => setDay(key, { enabled: v })}
                    />
                    <div>
                      <p className={`text-sm font-semibold leading-none ${day.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {label}
                        <span className="ml-1.5 text-[10px] font-normal text-muted-foreground hidden sm:inline">
                          {short}
                        </span>
                      </p>
                      {day.enabled && slotCount > 0 && (
                        <p className="text-[11px] text-emerald-600 mt-0.5">
                          {slotCount} consulta{slotCount !== 1 ? 's' : ''} disponível{slotCount !== 1 ? 'is' : ''}
                        </p>
                      )}
                      {day.enabled && day.slots.length === 0 && (
                        <p className="text-[11px] text-amber-500 mt-0.5">Nenhum horário configurado</p>
                      )}
                    </div>
                  </div>

                  {day.enabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => addSlot(key)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Horário
                    </Button>
                  )}
                </div>

                {/* Slots */}
                {day.enabled && day.slots.length > 0 && (
                  <div className="space-y-2 ml-9">
                    {day.slots.map((slot) => (
                      <div key={slot.id} className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                          <input
                            type="time"
                            value={slot.start}
                            onChange={e => updateSlot(key, slot.id, 'start', e.target.value)}
                            className="text-sm font-medium text-foreground bg-transparent border-none outline-none w-[5.5rem]"
                          />
                          <span className="text-muted-foreground text-xs font-medium">→</span>
                          <input
                            type="time"
                            value={slot.end}
                            onChange={e => updateSlot(key, slot.id, 'end', e.target.value)}
                            className="text-sm font-medium text-foreground bg-transparent border-none outline-none w-[5.5rem]"
                          />
                        </div>

                        {slot.start < slot.end && (
                          <span className="text-xs text-muted-foreground">
                            {countSlots([slot], schedule.duration)} vaga{countSlots([slot], schedule.duration) !== 1 ? 's' : ''}
                          </span>
                        )}

                        {slot.start >= slot.end && slot.end !== '' && (
                          <span className="text-xs text-red-500 flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            Horário inválido
                          </span>
                        )}

                        <button
                          onClick={() => removeSlot(key, slot.id)}
                          className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Disabled state */}
                {!day.enabled && (
                  <p className="text-xs text-muted-foreground ml-9 mt-1">Indisponível para agendamento</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Info note ── */}
      <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/50 rounded-xl p-4 border border-border/50">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          Os horários configurados serão exibidos para os pacientes ao agendar consultas com especialista.
          Para atendimentos imediatos, use o <strong>status Online/Offline</strong> no painel lateral.
        </p>
      </div>

      {/* ── Save ── */}
      <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Salvar agenda
      </Button>

    </div>
  );
}
