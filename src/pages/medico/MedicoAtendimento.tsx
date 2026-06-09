import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Video, User, FileText, FlaskConical, ClipboardCheck,
  PenLine, Plus, Trash2, Printer, CheckCircle, Clock, AlertCircle,
  Save, Stethoscope, Paperclip, Pill, Activity, ChevronsUpDown, Check,
} from 'lucide-react';
import {
  Command, CommandInput, CommandList, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { getMedicationCatalog } from '@/services/inventoryService';
import type { MedicationCatalog } from '@/types/inventory';
import type { IntakeData } from '@/lib/consultaDraft';
import { DoctorVideoPanel } from '@/components/medico/DoctorVideoPanel';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Consultation {
  id: string;
  patient_name: string;
  date: string;
  status: string;
  doctor_name: string;
  doctor_crm: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  quantity: string;
  instructions: string;
}

interface ExamRequest {
  id: string;
  name: string;
  justification: string;
  priority: 'routine' | 'urgent' | 'emergency';
}

interface Certificate {
  days: string;
  startDate: string;
  cidCode: string;
  reason: string;
  notes: string;
}

interface ConsultationDraft {
  anamnese: string;
  medications: Medication[];
  examRequests: ExamRequest[];
  certificate: Certificate | null;
  signed: boolean;
  signedAt: string | null;
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

function draftKey(id: string) { return `novita_draft_${id}`; }

function loadDraft(id: string): ConsultationDraft {
  try {
    const raw = localStorage.getItem(draftKey(id));
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return { anamnese: '', medications: [], examRequests: [], certificate: null, signed: false, signedAt: null };
}

function saveDraft(id: string, draft: ConsultationDraft) {
  localStorage.setItem(draftKey(id), JSON.stringify(draft));
}

// ─── Print helpers ────────────────────────────────────────────────────────────

function printDocument(title: string, content: string, doctor: string, crm: string, patient: string, date: string) {
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#111;font-size:14px}
    h1{font-size:20px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:24px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
    .header h2{font-size:18px;font-weight:bold;color:#1a56db;margin:0}
    .header p{font-size:12px;color:#555;margin:4px 0 0}
    .patient-box{background:#f5f5f5;padding:12px 16px;border-radius:6px;margin-bottom:24px;font-size:13px}
    .content{margin-bottom:32px}
    .item{border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin-bottom:10px}
    .item strong{font-size:15px}
    .item p{margin:4px 0;font-size:13px;color:#333}
    .signature{margin-top:60px;border-top:1px solid #333;padding-top:12px;text-align:center}
    .signature .sig-name{font-family:Georgia,serif;font-size:20px;color:#222}
    .signature .sig-crm{font-size:12px;color:#555;margin-top:4px}
    @media print{body{margin:20px}}
  </style>
</head><body>
  <div class="header">
    <div><h2>Novità Telemedicina</h2><p>Home Care & Teleconsulta</p></div>
    <div style="text-align:right;font-size:12px;color:#555">
      <p>${format(new Date(date), "dd/MM/yyyy", { locale: ptBR })}</p>
    </div>
  </div>
  <h1>${title}</h1>
  <div class="patient-box"><strong>Paciente:</strong> ${patient}</div>
  <div class="content">${content}</div>
  <div class="signature">
    <div class="sig-name">${doctor}</div>
    <div class="sig-crm">${crm}</div>
  </div>
  <script>window.onload=()=>{window.print()}<\/script>
</body></html>`);
  w.document.close();
}

// ─── Tab content components ───────────────────────────────────────────────────

function PatientIntakeCard({ intake }: { intake: IntakeData }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-200 bg-blue-100/50">
        <User className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-semibold text-blue-800">Informações enviadas pelo paciente</p>
      </div>
      <div className="p-4 space-y-3">
        {/* Symptoms */}
        <div>
          <p className="text-xs font-medium text-blue-700/70 flex items-center gap-1.5 mb-1.5">
            <Activity className="h-3.5 w-3.5" /> Sintomas relatados
          </p>
          {intake.sintomas.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {intake.sintomas.map((s) => (
                <span
                  key={s}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    s === intake.sintomaPrincipal
                      ? 'bg-amber-100 text-amber-800 border-amber-300 font-medium'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {s}{s === intake.sintomaPrincipal ? ' · principal' : ''}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Nenhum sintoma informado</p>
          )}
        </div>

        {/* Medications */}
        <div>
          <p className="text-xs font-medium text-blue-700/70 flex items-center gap-1.5 mb-1">
            <Pill className="h-3.5 w-3.5" /> Medicamentos em uso
          </p>
          <p className="text-sm text-gray-700">{intake.medicamentos?.trim() || 'Nenhum informado'}</p>
        </div>

        {/* Exam files */}
        {intake.exames.length > 0 && (
          <div>
            <p className="text-xs font-medium text-blue-700/70 flex items-center gap-1.5 mb-1.5">
              <Paperclip className="h-3.5 w-3.5" /> Exames anexados
            </p>
            <div className="space-y-1.5">
              {intake.exames.map((ex, i) => (
                <a
                  key={i}
                  href={ex.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg border border-blue-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-blue-700"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{ex.name}</span>
                  <span className="text-xs text-blue-500">Abrir</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnamneseTab({ value, onChange, intake }: { value: string; onChange: (v: string) => void; intake: IntakeData | null }) {
  return (
    <div className="space-y-4">
      {intake && <PatientIntakeCard intake={intake} />}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Registre a queixa principal e observações clínicas do paciente.
        </p>
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Queixa principal, histórico de sintomas, alergias, medicamentos em uso, exame físico..."
          className="min-h-[220px] text-sm resize-none"
        />
        <p className="text-xs text-muted-foreground">Salvo automaticamente.</p>
      </div>
    </div>
  );
}

// ─── Medication combobox (catalog dropdown) ───────────────────────────────────

function MedicationCombobox({ value, onSelect }: {
  value: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MedicationCatalog[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced server-side search against the medication catalog
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await getMedicationCatalog({ search: query.trim() || undefined, limit: 25 });
        if (!cancelled) setResults(data);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 250 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, open]);

  const label = (m: MedicationCatalog) => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}`;
  const pick = (name: string) => { onSelect(name); setOpen(false); setQuery(''); };
  const q = query.trim();

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`w-full justify-between font-normal ${value ? '' : 'text-muted-foreground'}`}
      >
        <span className="truncate">{value || 'Selecione ou busque um medicamento'}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <>
          {/* click-outside backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Buscar medicamento..." value={query} onValueChange={setQuery} autoFocus />
              <CommandList className="max-h-56">
                {loading ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">Buscando...</div>
                ) : (
                  <>
                    {results.length === 0 && !q && (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        Nenhum medicamento na base. Digite para usar um nome personalizado.
                      </div>
                    )}
                    {results.length > 0 && (
                      <CommandGroup heading="Base de medicamentos">
                        {results.map((m) => (
                          <CommandItem key={m.id} value={m.id} onSelect={() => pick(label(m))} className="flex items-center gap-2">
                            <Check className={`h-4 w-4 shrink-0 ${value === label(m) ? 'opacity-100' : 'opacity-0'}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{label(m)}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {[m.form, m.active_ingredient].filter(Boolean).join(' · ') || 'Medicamento'}
                              </p>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                              m.stock > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                            }`}>
                              {m.stock > 0 ? `${m.stock} un` : 'sem estoque'}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {q && (
                      <CommandGroup heading="Personalizado">
                        <CommandItem value="__custom__" onSelect={() => pick(q)} className="text-primary">
                          <Plus className="h-4 w-4 mr-2" /> Usar “{q}”
                        </CommandItem>
                      </CommandGroup>
                    )}
                  </>
                )}
              </CommandList>
            </Command>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Medication tab ───────────────────────────────────────────────────────────

function ReceitaTab({
  medications,
  onAdd,
  onRemove,
  onPrint,
}: {
  medications: Medication[];
  onAdd: (m: Medication) => void;
  onRemove: (id: string) => void;
  onPrint: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Medication, 'id'>>({
    name: '', dosage: '', quantity: '', instructions: '',
  });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    onAdd({ ...form, id: crypto.randomUUID() });
    setForm({ name: '', dosage: '', quantity: '', instructions: '' });
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {medications.length === 0 ? 'Nenhum medicamento adicionado.' : `${medications.length} medicamento${medications.length > 1 ? 's' : ''}`}
        </p>
        <div className="flex gap-2">
          {medications.length > 0 && (
            <Button variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Imprimir Receita
            </Button>
          )}
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
      </div>

      {medications.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Adicione medicamentos à receita</p>
        </div>
      ) : (
        <div className="space-y-2">
          {medications.map((m, i) => (
            <div key={m.id} className="flex items-start gap-3 p-4 rounded-xl border bg-white hover:border-primary/20 transition-colors">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{m.name}</p>
                {m.dosage && <p className="text-xs text-muted-foreground mt-0.5">{m.dosage}{m.quantity ? ` · ${m.quantity}` : ''}</p>}
                {m.instructions && <p className="text-xs text-foreground/70 mt-1 italic">{m.instructions}</p>}
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0" onClick={() => onRemove(m.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Medicamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Medicamento *</label>
              <MedicationCombobox value={form.name} onSelect={(name) => setForm(f => ({ ...f, name }))} />
              <p className="text-[11px] text-muted-foreground mt-1">Selecione da base ou digite para usar um nome personalizado.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Posologia</label>
                <Input placeholder="Ex: 1 comprimido 8/8h" value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantidade</label>
                <Input placeholder="Ex: 21 comprimidos" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
              <Textarea placeholder="Tomar com água, antes das refeições..." value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} className="resize-none h-20 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!form.name.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Exam tab ─────────────────────────────────────────────────────────────────

function ExamesTab({
  exams,
  onAdd,
  onRemove,
  onPrint,
}: {
  exams: ExamRequest[];
  onAdd: (e: ExamRequest) => void;
  onRemove: (id: string) => void;
  onPrint: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<ExamRequest, 'id'>>({
    name: '', justification: '', priority: 'routine',
  });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    onAdd({ ...form, id: crypto.randomUUID() });
    setForm({ name: '', justification: '', priority: 'routine' });
    setOpen(false);
  };

  const priorityLabel: Record<ExamRequest['priority'], { label: string; cls: string }> = {
    routine: { label: 'Rotina', cls: 'bg-gray-100 text-gray-600' },
    urgent: { label: 'Urgente', cls: 'bg-amber-100 text-amber-700' },
    emergency: { label: 'Emergência', cls: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {exams.length === 0 ? 'Nenhum exame solicitado.' : `${exams.length} exame${exams.length > 1 ? 's' : ''} solicitado${exams.length > 1 ? 's' : ''}`}
        </p>
        <div className="flex gap-2">
          {exams.length > 0 && (
            <Button variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Imprimir Pedido
            </Button>
          )}
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Solicitar Exame
          </Button>
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center">
          <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Adicione pedidos de exame</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exams.map((e) => {
            const { label, cls } = priorityLabel[e.priority];
            return (
              <div key={e.id} className="flex items-start gap-3 p-4 rounded-xl border bg-white hover:border-primary/20 transition-colors">
                <FlaskConical className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground">{e.name}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                  </div>
                  {e.justification && <p className="text-xs text-muted-foreground mt-1">{e.justification}</p>}
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0" onClick={() => onRemove(e.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Solicitar Exame</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Exame *</label>
              <Input placeholder="Ex: Hemograma completo" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
              <div className="flex gap-2">
                {(['routine', 'urgent', 'emergency'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.priority === p
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {p === 'routine' ? 'Rotina' : p === 'urgent' ? 'Urgente' : 'Emergência'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Justificativa clínica</label>
              <Textarea placeholder="Motivo da solicitação..." value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))} className="resize-none h-20 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!form.name.trim()}>Solicitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Certificate tab ──────────────────────────────────────────────────────────

function AtestadoTab({
  cert,
  onChange,
  onPrint,
}: {
  cert: Certificate | null;
  onChange: (c: Certificate | null) => void;
  onPrint: () => void;
}) {
  const empty: Certificate = {
    days: '', startDate: format(new Date(), 'yyyy-MM-dd'), cidCode: '', reason: '', notes: '',
  };
  const data = cert ?? empty;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Emita um atestado médico para o paciente.</p>
        {cert && cert.days && (
          <Button variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Imprimir Atestado
          </Button>
        )}
      </div>

      <div className="p-4 rounded-xl border bg-white space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Dias de afastamento *</label>
            <Input
              type="number"
              min="1"
              placeholder="Ex: 3"
              value={data.days}
              onChange={e => onChange({ ...data, days: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de início</label>
            <Input
              type="date"
              value={data.startDate}
              onChange={e => onChange({ ...data, startDate: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">CID-10</label>
          <Input
            placeholder="Ex: J06.9 — Infecção aguda do trato respiratório superior"
            value={data.cidCode}
            onChange={e => onChange({ ...data, cidCode: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Motivo / Diagnóstico *</label>
          <Textarea
            placeholder="Descreva a condição médica que justifica o afastamento..."
            value={data.reason}
            onChange={e => onChange({ ...data, reason: e.target.value })}
            className="resize-none h-20 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações adicionais</label>
          <Textarea
            placeholder="Restrições de atividade, recomendações médicas..."
            value={data.notes}
            onChange={e => onChange({ ...data, notes: e.target.value })}
            className="resize-none h-16 text-sm"
          />
        </div>

        <Button
          className="w-full gap-2"
          disabled={!data.days || !data.reason}
          onClick={() => onChange(data)}
          variant={cert ? 'outline' : 'default'}
        >
          <ClipboardCheck className="h-4 w-4" />
          {cert ? 'Atestado salvo' : 'Salvar Atestado'}
        </Button>
      </div>
    </div>
  );
}

// ─── Signature tab ────────────────────────────────────────────────────────────

function AssinaturaTab({
  signed, signedAt, doctorName, doctorCrm, onSign,
}: {
  signed: boolean;
  signedAt: string | null;
  doctorName: string;
  doctorCrm: string;
  onSign: () => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        A assinatura digital autentica todos os documentos emitidos nesta consulta.
      </p>

      <div className="p-6 rounded-xl border bg-white text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <PenLine className="h-7 w-7 text-primary" />
        </div>

        {signed ? (
          <div className="space-y-3">
            <Badge className="bg-green-100 text-green-700 border-green-200 text-sm px-3 py-1">
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Documentos Assinados
            </Badge>
            <div className="py-4 border-t border-b border-gray-100">
              <p
                className="text-2xl text-foreground"
                style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
              >
                {doctorName}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{doctorCrm}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Assinado em {signedAt ? format(new Date(signedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="py-4">
              <p
                className="text-2xl text-gray-300 select-none"
                style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
              >
                {doctorName}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{doctorCrm}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Clique para assinar digitalmente todos os documentos desta consulta.
            </p>
            <Button onClick={onSign} className="gap-2 w-full sm:w-auto">
              <PenLine className="h-4 w-4" />
              Assinar Documentos
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700 flex gap-3">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Esta é uma assinatura eletrônica para fins de demonstração. Em produção, a integração com
          certificado digital (ICP-Brasil) garantirá validade legal.
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'anamnese' | 'receita' | 'exames' | 'atestado' | 'assinatura';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'anamnese', label: 'Anamnese', icon: Stethoscope },
  { id: 'receita', label: 'Receita', icon: FileText },
  { id: 'exames', label: 'Exames', icon: FlaskConical },
  { id: 'atestado', label: 'Atestado', icon: ClipboardCheck },
  { id: 'assinatura', label: 'Assinatura', icon: PenLine },
];

export default function MedicoAtendimento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [draft, setDraft] = useState<ConsultationDraft>({ anamnese: '', medications: [], examRequests: [], certificate: null, signed: false, signedAt: null });
  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('anamnese');
  // Auto-start video when coming from queue via ?autostart=1
  const [showVideoPanel, setShowVideoPanel] = useState(searchParams.get('autostart') === '1');
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Latest draft + debounce timer for persisting clinical_data to the DB
  const draftRef = useRef<ConsultationDraft>(draft);
  draftRef.current = draft;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist clinical_data to the consultation row (so the patient can see it)
  const persistClinical = useCallback((next: ConsultationDraft) => {
    if (!id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      supabase.from('consultations').update({ clinical_data: next }).eq('id', id);
    }, 800);
  }, [id]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const { data } = await supabase
          .from('consultations')
          .select('id, patient_name, date, status, doctor_name, doctor_crm, intake_data, clinical_data')
          .eq('id', id)
          .single();
        setConsultation(data as Consultation | null);
        const row = data as unknown as { intake_data?: IntakeData | null; clinical_data?: ConsultationDraft | null } | null;
        // Prefer DB-persisted clinical data; fall back to the local draft (same browser)
        setDraft(row?.clinical_data ?? loadDraft(id));
        setIntake(row?.intake_data ?? null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Flush any pending DB save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        if (id) supabase.from('consultations').update({ clinical_data: draftRef.current }).eq('id', id);
      }
    };
  }, [id]);

  // Ring the patient whenever the doctor (re)opens the video on an open consultation
  useEffect(() => {
    if (showVideoPanel && id) {
      supabase
        .from('consultations')
        .update({ doctor_calling_at: new Date().toISOString() })
        .eq('id', id)
        .then(undefined, () => { /* ignore */ });
    }
  }, [showVideoPanel, id]);

  const updateDraft = useCallback((patch: Partial<ConsultationDraft>) => {
    setDraft(prev => {
      const next = { ...prev, ...patch };
      if (id) saveDraft(id, next);   // instant local cache (doctor's other pages)
      persistClinical(next);          // debounced DB persistence (visible to patient)
      return next;
    });
  }, [id, persistClinical]);

  const handleSign = () => {
    updateDraft({ signed: true, signedAt: new Date().toISOString() });
    toast({ title: 'Documentos assinados', description: 'Assinatura digital registrada com sucesso.' });
  };

  const handleFinish = async () => {
    if (!id || !consultation) return;
    setFinishing(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      // Persist the final documents together with the completed status
      await supabase
        .from('consultations')
        .update({ status: 'completed', clinical_data: draftRef.current, updated_at: new Date().toISOString() })
        .eq('id', id);
      toast({ title: 'Atendimento finalizado', description: `Consulta de ${consultation.patient_name} encerrada.` });
      navigate('/medico/consultas');
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível finalizar o atendimento.', variant: 'destructive' });
    } finally {
      setFinishing(false);
      setShowFinishDialog(false);
    }
  };

  const printReceita = () => {
    if (!consultation) return;
    const content = draft.medications
      .map((m, i) => `<div class="item"><strong>${i + 1}. ${m.name}</strong>
        ${m.dosage ? `<p>Posologia: ${m.dosage}</p>` : ''}
        ${m.quantity ? `<p>Quantidade: ${m.quantity}</p>` : ''}
        ${m.instructions ? `<p>Obs: ${m.instructions}</p>` : ''}
      </div>`)
      .join('');
    printDocument('Receita Médica', content, consultation.doctor_name, consultation.doctor_crm, consultation.patient_name, consultation.date);
  };

  const printExames = () => {
    if (!consultation) return;
    const content = draft.examRequests
      .map((e) => `<div class="item"><strong>${e.name}</strong>
        <p>Prioridade: ${e.priority === 'routine' ? 'Rotina' : e.priority === 'urgent' ? 'Urgente' : 'Emergência'}</p>
        ${e.justification ? `<p>Justificativa: ${e.justification}</p>` : ''}
      </div>`)
      .join('');
    printDocument('Pedido de Exames', content, consultation.doctor_name, consultation.doctor_crm, consultation.patient_name, consultation.date);
  };

  const printAtestado = () => {
    if (!consultation || !draft.certificate) return;
    const c = draft.certificate;
    const endDate = new Date(c.startDate);
    endDate.setDate(endDate.getDate() + Number(c.days) - 1);
    const content = `
      <div class="item">
        <p>Atesto que o(a) paciente <strong>${consultation.patient_name}</strong> necessita de afastamento
        de suas atividades pelo período de <strong>${c.days} dia${Number(c.days) > 1 ? 's' : ''}</strong>,
        a partir de ${format(new Date(c.startDate), "dd/MM/yyyy")}.</p>
        ${c.cidCode ? `<p><strong>CID-10:</strong> ${c.cidCode}</p>` : ''}
        <p><strong>Diagnóstico:</strong> ${c.reason}</p>
        ${c.notes ? `<p><strong>Observações:</strong> ${c.notes}</p>` : ''}
      </div>`;
    printDocument('Atestado Médico', content, consultation.doctor_name, consultation.doctor_crm, consultation.patient_name, consultation.date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Consulta não encontrada.</p>
        <Button variant="outline" onClick={() => navigate('/medico/consultas')}>
          Voltar para Consultas
        </Button>
      </div>
    );
  }

  const isCompleted = consultation.status === 'completed';

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" className="shrink-0 gap-1.5" onClick={() => navigate('/medico/consultas')}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="h-5 w-px bg-gray-200 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">{consultation.patient_name}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(consultation.date), "dd/MM/yyyy", { locale: ptBR })} · #{consultation.id.slice(0, 8)}
            </p>
          </div>
          {consultation.status === 'in_progress' && (
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 shrink-0 hidden sm:flex">
              <Clock className="h-3 w-3 mr-1" /> Em Atendimento
            </Badge>
          )}
          {isCompleted && (
            <Badge className="bg-green-100 text-green-700 border-green-200 shrink-0 hidden sm:flex">
              <CheckCircle className="h-3 w-3 mr-1" /> Concluída
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isCompleted && !showVideoPanel && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 hidden sm:flex"
              onClick={() => setShowVideoPanel(true)}
            >
              <Video className="h-3.5 w-3.5" />
              Iniciar Videochamada
            </Button>
          )}

          {!isCompleted && (
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700"
              onClick={() => setShowFinishDialog(true)}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Finalizar
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: patient info sidebar (always visible — video is now a floating window) */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Patient card */}
            <div className="text-center pt-2">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <User className="h-7 w-7 text-primary" />
              </div>
              <p className="font-semibold text-sm text-foreground leading-snug">{consultation.patient_name}</p>
              <p className="text-xs text-muted-foreground mt-1">Paciente</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-gray-50">
                <p className="text-muted-foreground mb-0.5">Data da consulta</p>
                <p className="font-medium text-foreground">
                  {format(new Date(consultation.date), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50">
                <p className="text-muted-foreground mb-0.5">Médico</p>
                <p className="font-medium text-foreground truncate">{consultation.doctor_name}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50">
                <p className="text-muted-foreground mb-0.5">CRM</p>
                <p className="font-medium text-foreground">{consultation.doctor_crm}</p>
              </div>
            </div>

            {/* Documents summary */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Documentos</p>
              <SummaryItem label="Medicamentos" count={draft.medications.length} icon={FileText} />
              <SummaryItem label="Exames" count={draft.examRequests.length} icon={FlaskConical} />
              <SummaryItem label="Atestado" count={draft.certificate ? 1 : 0} icon={ClipboardCheck} />
              <SummaryItem label="Assinado" count={draft.signed ? 1 : 0} icon={PenLine} />
            </div>
          </div>
        </aside>

        {/* Right: workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="bg-white border-b border-gray-200 px-5 flex gap-0 overflow-x-auto shrink-0">
            {TABS.map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`
                  flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${activeTab === tabId
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                  }
                `}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {tabId === 'receita' && draft.medications.length > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                    {draft.medications.length}
                  </span>
                )}
                {tabId === 'exames' && draft.examRequests.length > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center">
                    {draft.examRequests.length}
                  </span>
                )}
                {tabId === 'assinatura' && draft.signed && (
                  <CheckCircle className="h-3 w-3 text-green-500 ml-1" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                  {TABS.find(t => t.id === activeTab)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isCompleted && (
                  <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2 text-sm text-blue-700">
                    <FileText className="h-4 w-4 shrink-0" />
                    Consulta concluída — você pode revisar e emitir os documentos (receita, exames, atestado).
                  </div>
                )}

                {activeTab === 'anamnese' && (
                  <AnamneseTab
                    value={draft.anamnese}
                    onChange={v => updateDraft({ anamnese: v })}
                    intake={intake}
                  />
                )}
                {activeTab === 'receita' && (
                  <ReceitaTab
                    medications={draft.medications}
                    onAdd={m => updateDraft({ medications: [...draft.medications, m] })}
                    onRemove={rmId => updateDraft({ medications: draft.medications.filter(m => m.id !== rmId) })}
                    onPrint={printReceita}
                  />
                )}
                {activeTab === 'exames' && (
                  <ExamesTab
                    exams={draft.examRequests}
                    onAdd={e => updateDraft({ examRequests: [...draft.examRequests, e] })}
                    onRemove={rmId => updateDraft({ examRequests: draft.examRequests.filter(e => e.id !== rmId) })}
                    onPrint={printExames}
                  />
                )}
                {activeTab === 'atestado' && (
                  <AtestadoTab
                    cert={draft.certificate}
                    onChange={c => updateDraft({ certificate: c })}
                    onPrint={printAtestado}
                  />
                )}
                {activeTab === 'assinatura' && (
                  <AssinaturaTab
                    signed={draft.signed}
                    signedAt={draft.signedAt}
                    doctorName={consultation.doctor_name}
                    doctorCrm={consultation.doctor_crm}
                    onSign={handleSign}
                  />
                )}
              </CardContent>
            </Card>

            {/* Save indicator */}
            <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
              <Save className="h-3 w-3" />
              {isCompleted ? 'Alterações salvas automaticamente' : 'Salvo automaticamente durante o atendimento'}
            </div>
          </div>
        </div>
      </div>

      {/* Floating video window (draggable / resizable PiP) */}
      {showVideoPanel && id && consultation && (
        <DoctorVideoPanel
          consultationId={id}
          patientName={consultation.patient_name}
          consultationDate={consultation.date}
          intake={intake}
          onCallEnded={() => setShowVideoPanel(false)}
        />
      )}

      {/* Finish dialog */}
      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O atendimento de <strong>{consultation.patient_name}</strong> será marcado como concluído.
              {!draft.signed && (
                <span className="block mt-2 text-amber-600">
                  ⚠ Os documentos ainda não foram assinados digitalmente.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinish}
              disabled={finishing}
              className="bg-green-600 hover:bg-green-700"
            >
              {finishing ? 'Finalizando...' : 'Confirmar Finalização'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Summary item (sidebar) ───────────────────────────────────────────────────

function SummaryItem({
  label, count, icon: Icon,
}: { label: string; count: number; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />{label}
      </span>
      <span className={`font-semibold ${count > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
        {count}
      </span>
    </div>
  );
}
