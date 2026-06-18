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
  Eye, Download, Loader2, Headphones,
} from 'lucide-react';
import {
  Command, CommandInput, CommandList, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { getMedicationCatalog } from '@/services/inventoryService';
import type { MedicationCatalog } from '@/types/inventory';
import type { IntakeData } from '@/lib/consultaDraft';
import { openExamFile } from '@/lib/examFiles';
import { logEvent } from '@/lib/audit';
import {
  signAndStorePrescription, getPrescriptionByConsultation, getSignedPrescriptionUrl,
} from '@/services/prescriptionService';
import {
  signAndStoreExamRequest, signAndStoreCertificate, getConsultationDocuments,
  getSignedDocumentUrl, type ConsultationDocumentRecord,
} from '@/services/consultationDocumentService';
import { buildPrescriptionPdf } from '@/components/prescription/PrescriptionPdf';
import { buildExamRequestPdf, buildCertificatePdf } from '@/components/documents/MedicalDocsPdf';
import { DoctorVideoPanel } from '@/components/medico/DoctorVideoPanel';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Consultation {
  id: string;
  patient_name: string;
  date: string;
  status: string;
  doctor_name: string;
  doctor_crm: string;
  number?: number | null;
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
  prescriptionGuidance?: string;   // orientações médicas gerais da receita
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
  return { anamnese: '', medications: [], prescriptionGuidance: '', examRequests: [], certificate: null, signed: false, signedAt: null };
}

function saveDraft(id: string, draft: ConsultationDraft) {
  localStorage.setItem(draftKey(id), JSON.stringify(draft));
}

// ─── Print helpers ────────────────────────────────────────────────────────────

// Impressão de RASCUNHO (sem assinatura digital). Todo conteúdo interpolado é
// sanitizado com DOMPurify antes de ir para o document.write (evita XSS via
// nome de medicamento/anamnese), e o documento é claramente marcado como
// rascunho sem validade jurídica — o documento válido sai pela aba Assinatura.
function printDocument(title: string, content: string, doctor: string, crm: string, patient: string, date: string) {
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) return;
  const clean = (s: string) => DOMPurify.sanitize(s, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  const safeTitle = clean(title);
  const safeDoctor = clean(doctor);
  const safeCrm = clean(crm);
  const safePatient = clean(patient);
  const safeContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['div', 'strong', 'p', 'br', 'span'],
    ALLOWED_ATTR: ['class'],
  });
  let safeDate = '';
  try { safeDate = format(new Date(date), 'dd/MM/yyyy', { locale: ptBR }); } catch { safeDate = ''; }

  w.document.write(`<!DOCTYPE html><html><head>
  <meta charset="utf-8">
  <title>${safeTitle} (rascunho)</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#111;font-size:14px}
    h1{font-size:20px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:24px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
    .header h2{font-size:18px;font-weight:bold;color:#1a56db;margin:0}
    .header p{font-size:12px;color:#555;margin:4px 0 0}
    .draft-banner{border:1px solid #f59e0b;background:#fffbeb;color:#b45309;font-weight:bold;
      font-size:12px;text-align:center;padding:8px;border-radius:6px;margin-bottom:24px;letter-spacing:.3px}
    .patient-box{background:#f5f5f5;padding:12px 16px;border-radius:6px;margin-bottom:24px;font-size:13px}
    .content{margin-bottom:32px}
    .item{border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin-bottom:10px}
    .item strong{font-size:15px}
    .item p{margin:4px 0;font-size:13px;color:#333}
    .signature{margin-top:60px;border-top:1px solid #333;padding-top:12px;text-align:center}
    .signature .sig-name{font-family:Georgia,serif;font-size:20px;color:#222}
    .signature .sig-crm{font-size:12px;color:#555;margin-top:4px}
    .signature .sig-warn{font-size:11px;color:#b45309;margin-top:6px}
    @media print{body{margin:20px}}
  </style>
</head><body>
  <div class="header">
    <div><h2>Novità Telemedicina</h2><p>Home Care & Teleconsulta</p></div>
    <div style="text-align:right;font-size:12px;color:#555">
      <p>${safeDate}</p>
    </div>
  </div>
  <div class="draft-banner">RASCUNHO — DOCUMENTO SEM ASSINATURA DIGITAL · SEM VALIDADE JURÍDICA</div>
  <h1>${safeTitle}</h1>
  <div class="patient-box"><strong>Paciente:</strong> ${safePatient}</div>
  <div class="content">${safeContent}</div>
  <div class="signature">
    <div class="sig-name">${safeDoctor}</div>
    <div class="sig-crm">${safeCrm}</div>
    <div class="sig-warn">Documento não assinado digitalmente. Para validade jurídica, assine na aba Assinatura.</div>
  </div>
  <script>window.onload=()=>{window.print()}</script>
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
        {/* Chief complaint (free text) */}
        {intake.descricao?.trim() && (
          <div>
            <p className="text-xs font-medium text-blue-700/70 flex items-center gap-1.5 mb-1">
              <FileText className="h-3.5 w-3.5" /> Queixa relatada
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{intake.descricao.trim()}</p>
          </div>
        )}

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

        {/* Duration + intensity */}
        {(intake.duracao || intake.intensidade != null) && (
          <div className="flex flex-wrap gap-6">
            {intake.duracao && (
              <div>
                <p className="text-xs font-medium text-blue-700/70 flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5" /> Duração
                </p>
                <p className="text-sm text-gray-700">{intake.duracao}</p>
              </div>
            )}
            {intake.intensidade != null && (
              <div>
                <p className="text-xs font-medium text-blue-700/70 flex items-center gap-1.5 mb-1">
                  <Activity className="h-3.5 w-3.5" /> Intensidade
                </p>
                <p className="text-sm text-gray-700">{intake.intensidade}/10</p>
              </div>
            )}
          </div>
        )}

        {/* Medications */}
        <div>
          <p className="text-xs font-medium text-blue-700/70 flex items-center gap-1.5 mb-1">
            <Pill className="h-3.5 w-3.5" /> Medicamentos em uso
          </p>
          <p className="text-sm text-gray-700">{intake.medicamentos?.trim() || 'Nenhum informado'}</p>
        </div>

        {/* Allergies */}
        <div>
          <p className="text-xs font-medium text-blue-700/70 flex items-center gap-1.5 mb-1">
            <AlertCircle className="h-3.5 w-3.5" /> Alergias
          </p>
          <p className="text-sm text-gray-700">{intake.alergias?.trim() || 'Nenhuma informada'}</p>
        </div>

        {/* Exam files */}
        {intake.exames.length > 0 && (
          <div>
            <p className="text-xs font-medium text-blue-700/70 flex items-center gap-1.5 mb-1.5">
              <Paperclip className="h-3.5 w-3.5" /> Exames anexados
            </p>
            <div className="space-y-1.5">
              {intake.exames.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => openExamFile(ex)}
                  className="flex w-full items-center gap-2 p-2 rounded-lg border border-blue-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-blue-700 text-left"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{ex.name}</span>
                  <span className="text-xs text-blue-500">Abrir</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Triage info (attendant-authored, surfaced to the doctor) ─────────────────

interface TriageInfo {
  priority: string | null;
  specialty: string | null;
  attendantName: string | null;
  orientacao: string | null;
}

// Mirror the labels used in the attendant panel (AtendenteTriagem.tsx).
const SPECIALTY_LABELS: Record<string, string> = {
  clinico_geral: 'Clínico geral',
  pediatria: 'Pediatria',
  dermatologia: 'Dermatologia',
  ginecologia: 'Ginecologia',
  psiquiatria: 'Psiquiatria',
  cardiologia: 'Cardiologia',
};

const PRIORITY_LABELS: Record<string, { label: string; cls: string }> = {
  normal:   { label: 'Normal',      cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  priority: { label: 'Prioritário', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  urgent:   { label: 'Urgente',     cls: 'bg-red-100 text-red-700 border-red-200' },
};

// True only when triage actually carries something worth showing — avoids an
// empty "Triagem" card on legacy/backfilled rows that never passed an attendant.
function hasTriageContent(t: TriageInfo | null): t is TriageInfo {
  return !!(t && (
    t.orientacao?.trim() ||
    t.specialty ||
    t.attendantName ||
    (t.priority && t.priority !== 'normal')
  ));
}

function TriageInfoCard({ triage }: { triage: TriageInfo }) {
  const prio = triage.priority ? PRIORITY_LABELS[triage.priority] : null;
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-teal-200 bg-teal-100/50">
        <Headphones className="h-4 w-4 text-teal-600" />
        <p className="text-sm font-semibold text-teal-800">
          Triagem do atendente{triage.attendantName ? ` · ${triage.attendantName}` : ''}
        </p>
      </div>
      <div className="p-4 space-y-3">
        {(prio || triage.specialty) && (
          <div className="flex flex-wrap items-center gap-2">
            {prio && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${prio.cls}`}>
                Prioridade: {prio.label}
              </span>
            )}
            {triage.specialty && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-white text-gray-600 border-gray-200">
                {SPECIALTY_LABELS[triage.specialty] ?? triage.specialty}
              </span>
            )}
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-teal-700/70 flex items-center gap-1.5 mb-1">
            <FileText className="h-3.5 w-3.5" /> Orientação inicial
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {triage.orientacao?.trim() || 'Nenhuma orientação registrada pelo atendente.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function AnamneseTab({ value, onChange, intake, triage }: { value: string; onChange: (v: string) => void; intake: IntakeData | null; triage: TriageInfo | null }) {
  return (
    <div className="space-y-4">
      {triage && <TriageInfoCard triage={triage} />}
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

// Posologias frequentes — clique preenche o campo (agiliza a prescrição).
const POSOLOGY_PRESETS = [
  '1 comprimido 8/8h',
  '1 comprimido 12/12h',
  '1 comprimido 1x ao dia',
  '1 comprimido 6/6h',
  'Se necessário',
];

function ReceitaTab({
  medications,
  guidance,
  onAdd,
  onRemove,
  onGuidanceChange,
  locked,
  onReopen,
}: {
  medications: Medication[];
  guidance: string;
  onAdd: (m: Medication) => void;
  onRemove: (id: string) => void;
  onGuidanceChange: (v: string) => void;
  locked: boolean;
  onReopen: () => void;
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
      {/* Locked after signing — editing requires an explicit reopen so the
          draft never diverges silently from the signed PDF. */}
      {locked && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3 flex-wrap">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 flex-1 min-w-0">
            Receita assinada e bloqueada para edição. Para alterar, reabra — será necessário assinar novamente.
          </p>
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={onReopen}>
            <PenLine className="h-3.5 w-3.5" /> Reabrir para editar
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {medications.length === 0 ? 'Nenhum medicamento adicionado.' : `${medications.length} medicamento${medications.length > 1 ? 's' : ''}`}
        </p>
        {!locked && (
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        )}
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
              {!locked && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0" onClick={() => onRemove(m.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5 pt-1">
        <label className="text-xs font-medium text-muted-foreground">Orientações médicas (gerais)</label>
        <Textarea
          value={guidance}
          onChange={e => onGuidanceChange(e.target.value)}
          disabled={locked}
          placeholder="Orientações gerais ao paciente: repouso, hidratação, sinais de alerta, retorno..."
          className="resize-none h-20 text-sm disabled:opacity-70"
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 space-y-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Pill className="h-[22px] w-[22px] text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base leading-tight">Adicionar medicamento</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Busque na base de medicamentos ou digite um nome personalizado para incluir na receita.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Medicamento */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                Medicamento <span className="text-red-500">*</span>
              </label>
              <MedicationCombobox value={form.name} onSelect={(name) => setForm(f => ({ ...f, name }))} />
              <p className="text-[11px] text-muted-foreground">Selecione da base ou digite para usar um nome personalizado.</p>
            </div>

            {/* Posologia + Quantidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Posologia
                </label>
                <Input placeholder="Ex: 1 comprimido 8/8h" value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))} />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {POSOLOGY_PRESETS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, dosage: p }))}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Quantidade
                </label>
                <Input placeholder="Ex: 21 comprimidos" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Observações</label>
              <Textarea
                placeholder="Tomar com água, antes das refeições, sinais de alerta..."
                value={form.instructions}
                onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                className="resize-none h-24 text-sm"
              />
            </div>

            {/* Pré-visualização do item na receita */}
            {form.name.trim() && (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5">
                <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Como vai aparecer na receita
                </p>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {medications.length + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground">{form.name}</p>
                    {(form.dosage || form.quantity) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {form.dosage}{form.dosage && form.quantity ? ' · ' : ''}{form.quantity}
                      </p>
                    )}
                    {form.instructions && <p className="text-xs text-foreground/70 mt-1 italic">{form.instructions}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/20">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!form.name.trim()} className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar à receita
            </Button>
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
}: {
  exams: ExamRequest[];
  onAdd: (e: ExamRequest) => void;
  onRemove: (id: string) => void;
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
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Solicitar Exame
        </Button>
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
}: {
  cert: Certificate | null;
  onChange: (c: Certificate | null) => void;
}) {
  const empty: Certificate = {
    days: '', startDate: format(new Date(), 'yyyy-MM-dd'), cidCode: '', reason: '', notes: '',
  };
  const data = cert ?? empty;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Emita um atestado médico para o paciente.</p>

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

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'paciente' | 'anamnese' | 'receita' | 'exames' | 'atestado';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'paciente', label: 'Paciente', icon: User },
  { id: 'anamnese', label: 'Anamnese', icon: Stethoscope },
  { id: 'receita', label: 'Receita', icon: FileText },
  { id: 'exames', label: 'Exames', icon: FlaskConical },
  { id: 'atestado', label: 'Atestado', icon: ClipboardCheck },
];

// ─── Document action footer — reused at the bottom of every document tab ───────
// One place per document: state (rascunho/assinado) + secondary actions
// (pré-visualizar / imprimir rascunho) + the single primary "Assinar e emitir".
function DocumentActionFooter({
  ready, hint, signed, signedAt, signing, pdfUrl,
  onPreview, onPrint, onSign, canResign,
}: {
  ready: boolean;
  hint: string;
  signed: boolean;
  signedAt: string | null;
  signing: boolean;
  pdfUrl: string | null;
  onPreview: () => void;
  onPrint: () => void;
  onSign: () => void;
  /** Exame/atestado podem reassinar; receita é travada (reabrir no topo da aba). */
  canResign?: boolean;
}) {
  return (
    <div className="mt-5 border-t border-border/60 pt-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="text-xs">
        {signed ? (
          <span className="inline-flex items-center gap-1.5 text-green-700 font-medium">
            <CheckCircle className="h-3.5 w-3.5" />
            Assinado{signedAt ? ` em ${format(new Date(signedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}` : ''}
          </span>
        ) : ready ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <PenLine className="h-3.5 w-3.5" /> Rascunho — pronto para assinar
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" /> {hint}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {ready && (
          <Button variant="ghost" size="sm" onClick={onPreview} className="gap-1.5 text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Pré-visualizar
          </Button>
        )}
        {ready && (
          <Button variant="ghost" size="sm" onClick={onPrint} className="gap-1.5 text-muted-foreground" title="Imprimir rascunho (sem validade)">
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Button>
        )}
        {signed && pdfUrl && (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" /> Baixar PDF
            </a>
          </Button>
        )}
        {(!signed || canResign) && (
          <Button size="sm" className="gap-1.5" disabled={!ready || signing} onClick={onSign}>
            {signing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
            {signing ? 'Assinando…' : signed ? 'Assinar novamente' : 'Assinar e emitir'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function MedicoAtendimento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [draft, setDraft] = useState<ConsultationDraft>({ anamnese: '', medications: [], prescriptionGuidance: '', examRequests: [], certificate: null, signed: false, signedAt: null });
  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [triage, setTriage] = useState<TriageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('paciente');
  // Auto-start video when coming from queue via ?autostart=1
  const [showVideoPanel, setShowVideoPanel] = useState(searchParams.get('autostart') === '1');
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  // Exame/atestado assinados (tabela consultation_documents)
  const [examDoc, setExamDoc] = useState<ConsultationDocumentRecord | null>(null);
  const [certDoc, setCertDoc] = useState<ConsultationDocumentRecord | null>(null);
  const [examPdfUrl, setExamPdfUrl] = useState<string | null>(null);
  const [certPdfUrl, setCertPdfUrl] = useState<string | null>(null);
  const [signingExam, setSigningExam] = useState(false);
  const [signingCert, setSigningCert] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('Pré-visualização');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Latest draft + debounce timer for persisting clinical_data to the DB
  const draftRef = useRef<ConsultationDraft>(draft);
  draftRef.current = draft;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Honest save state — never tell the doctor "saved" without confirming the
  // write, and surface failures (with retry) so clinical notes aren't lost silently.
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Persist clinical_data to the consultation row (so the patient can see it)
  const persistClinical = useCallback((next: ConsultationDraft) => {
    if (!id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from('consultations').update({ clinical_data: next }).eq('id', id);
      if (error) {
        setSaveStatus('error');
      } else {
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      }
    }, 800);
  }, [id]);

  const retrySave = useCallback(() => {
    if (id) persistClinical(draftRef.current);
  }, [id, persistClinical]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const { data } = await supabase
          .from('consultations')
          .select('id, patient_name, date, status, doctor_name, doctor_crm, intake_data, clinical_data, number, triage_data, priority, specialty, attendant_name')
          .eq('id', id)
          .single();

        let consultationRow = data as Consultation | null;

        // Backfill the doctor's CRM/name on an active consultation that was
        // accepted before the CRM was registered in the profile. Without this,
        // the consultation keeps the empty CRM saved at accept time and the
        // "CRM não cadastrado" warning sticks even after the doctor fills it in.
        if (consultationRow && consultationRow.status === 'in_consultation' && !consultationRow.doctor_crm?.trim()) {
          const { data: { user } } = await supabase.auth.getUser();
          const meta = (user?.user_metadata ?? {}) as { doctor_crm?: string; full_name?: string };
          const crm = (meta.doctor_crm ?? '').trim();
          if (crm) {
            const doctorName = consultationRow.doctor_name?.trim() || meta.full_name || consultationRow.doctor_name;
            await supabase.from('consultations').update({ doctor_crm: crm, doctor_name: doctorName }).eq('id', id);
            consultationRow = { ...consultationRow, doctor_crm: crm, doctor_name: doctorName };
          }
        }

        setConsultation(consultationRow);
        const row = data as unknown as {
          intake_data?: IntakeData | null;
          clinical_data?: ConsultationDraft | null;
          triage_data?: { orientacao?: string | null } | null;
          priority?: string | null;
          specialty?: string | null;
          attendant_name?: string | null;
        } | null;
        // Prefer DB-persisted clinical data; fall back to the local draft (same browser)
        setDraft(row?.clinical_data ?? loadDraft(id));
        setIntake(row?.intake_data ?? null);
        setTriage(row ? {
          priority: row.priority ?? null,
          specialty: row.specialty ?? null,
          attendantName: row.attendant_name ?? null,
          orientacao: row.triage_data?.orientacao ?? null,
        } : null);
        if (data) {
          // Sensitive-data access trail: every chart open is recorded
          logEvent('doctor_opened_consultation', { consultationId: id });
        }
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

  // Ring the patient whenever the doctor (re)opens the video — only while the
  // consultation is open (CARD-05: no calls on completed/cancelled rooms).
  useEffect(() => {
    if (showVideoPanel && id && consultation?.status === 'in_consultation') {
      supabase
        .from('consultations')
        .update({ doctor_calling_at: new Date().toISOString() })
        .eq('id', id)
        .then(undefined, () => { /* ignore */ });
    }
  }, [showVideoPanel, id, consultation?.status]);

  // If the prescription was already signed before, fetch its PDF link for download.
  useEffect(() => {
    if (!id || !draft.signed || signedPdfUrl) return;
    let cancelled = false;
    (async () => {
      const rec = await getPrescriptionByConsultation(id);
      if (!cancelled && rec?.pdf_path) {
        const url = await getSignedPrescriptionUrl(rec.pdf_path);
        if (!cancelled) setSignedPdfUrl(url);
      }
    })();
    return () => { cancelled = true; };
  }, [id, draft.signed, signedPdfUrl]);

  // Carrega exame/atestado já assinados (consultation_documents) para refletir o
  // status na aba Assinatura e permitir baixar o PDF.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const docs = await getConsultationDocuments(id);
        if (cancelled) return;
        const exam = docs.find(d => d.doc_type === 'exam_request') ?? null;
        const cert = docs.find(d => d.doc_type === 'certificate') ?? null;
        setExamDoc(exam);
        setCertDoc(cert);
        if (exam?.pdf_path) { const u = await getSignedDocumentUrl(exam.pdf_path); if (!cancelled) setExamPdfUrl(u); }
        if (cert?.pdf_path) { const u = await getSignedDocumentUrl(cert.pdf_path); if (!cancelled) setCertPdfUrl(u); }
      } catch { /* sem documentos assinados */ }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const updateDraft = useCallback((patch: Partial<ConsultationDraft>) => {
    setDraft(prev => {
      const next = { ...prev, ...patch };
      if (id) saveDraft(id, next);   // instant local cache (doctor's other pages)
      persistClinical(next);          // debounced DB persistence (visible to patient)
      return next;
    });
  }, [id, persistClinical]);

  // Map the current prescription draft to the shape used by the PDF/sign services.
  const prescriptionMeds = useCallback(() => draftRef.current.medications.map(m => ({
    name: m.name, dosage: m.dosage, quantity: m.quantity, instructions: m.instructions,
  })), []);

  // Reopen a signed prescription for editing — a deliberate action that requires
  // re-signing afterwards (keeps the signed PDF and the draft from diverging silently).
  const handleReopenReceita = () => {
    updateDraft({ signed: false, signedAt: null });
    if (id) logEvent('doctor_reopened_prescription', { consultationId: id });
    toast({
      title: 'Receita reaberta para edição',
      description: 'Após alterar, assine novamente para gerar a versão atualizada.',
    });
  };

  // Documents are only legally valid with a real CRM. Block signing when the
  // consultation has no CRM (e.g. accepted before the CRM fix) and guide the
  // doctor to complete it in Configurações › CRM/RQE.
  const ensureCrm = () => {
    if (consultation?.doctor_crm?.trim()) return true;
    toast({
      title: 'CRM não informado',
      description: 'Cadastre seu CRM em Configurações › CRM/RQE para assinar documentos com validade.',
      variant: 'destructive',
    });
    navigate('/medico/configuracoes?tab=crm');
    return false;
  };

  const handleSignPrescription = async () => {
    if (!id || !consultation) return;
    if (!ensureCrm()) return;
    if (draftRef.current.medications.length === 0) {
      toast({ title: 'Receita vazia', description: 'Adicione ao menos um medicamento antes de assinar.', variant: 'destructive' });
      return;
    }
    setSigning(true);
    try {
      const rec = await signAndStorePrescription({
        consultationId: id,
        patientName: consultation.patient_name,
        doctor: { name: consultation.doctor_name, crm: consultation.doctor_crm },
        date: consultation.date,
        consultationRef: consultation.number ?? consultation.id.slice(0, 8),
        medications: prescriptionMeds(),
        guidance: draftRef.current.prescriptionGuidance,
      });
      updateDraft({ signed: true, signedAt: rec.signed_at ?? new Date().toISOString() });
      if (rec.pdf_path) setSignedPdfUrl(await getSignedPrescriptionUrl(rec.pdf_path));
      toast({ title: 'Receita assinada', description: 'Assinatura registrada e receita salva no histórico do paciente.' });
    } catch (e) {
      toast({ title: 'Erro ao assinar', description: e instanceof Error ? e.message : 'Não foi possível assinar a receita.', variant: 'destructive' });
    } finally {
      setSigning(false);
    }
  };

  const handleSignExame = async () => {
    if (!id || !consultation) return;
    if (!ensureCrm()) return;
    if (draftRef.current.examRequests.length === 0) {
      toast({ title: 'Sem exames', description: 'Adicione ao menos um exame na aba Exames antes de assinar.', variant: 'destructive' });
      return;
    }
    setSigningExam(true);
    try {
      const rec = await signAndStoreExamRequest({
        consultationId: id,
        patientName: consultation.patient_name,
        doctor: { name: consultation.doctor_name, crm: consultation.doctor_crm },
        date: consultation.date,
        consultationRef: consultation.number ?? consultation.id.slice(0, 8),
        exams: draftRef.current.examRequests.map(e => ({ name: e.name, priority: e.priority, justification: e.justification })),
      });
      setExamDoc(rec);
      if (rec.pdf_path) setExamPdfUrl(await getSignedDocumentUrl(rec.pdf_path));
      toast({ title: 'Pedido de exame assinado', description: 'Documento salvo no histórico do paciente.' });
    } catch (e) {
      toast({ title: 'Erro ao assinar', description: e instanceof Error ? e.message : 'Não foi possível assinar o pedido de exame.', variant: 'destructive' });
    } finally {
      setSigningExam(false);
    }
  };

  const handleSignAtestado = async () => {
    if (!id || !consultation) return;
    if (!ensureCrm()) return;
    const c = draftRef.current.certificate;
    if (!c || !c.days || !c.reason) {
      toast({ title: 'Atestado incompleto', description: 'Preencha dias e motivo na aba Atestado antes de assinar.', variant: 'destructive' });
      return;
    }
    setSigningCert(true);
    try {
      const rec = await signAndStoreCertificate({
        consultationId: id,
        patientName: consultation.patient_name,
        doctor: { name: consultation.doctor_name, crm: consultation.doctor_crm },
        date: consultation.date,
        consultationRef: consultation.number ?? consultation.id.slice(0, 8),
        days: c.days, startDate: c.startDate, cidCode: c.cidCode, reason: c.reason, notes: c.notes,
      });
      setCertDoc(rec);
      if (rec.pdf_path) setCertPdfUrl(await getSignedDocumentUrl(rec.pdf_path));
      toast({ title: 'Atestado assinado', description: 'Documento salvo no histórico do paciente.' });
    } catch (e) {
      toast({ title: 'Erro ao assinar', description: e instanceof Error ? e.message : 'Não foi possível assinar o atestado.', variant: 'destructive' });
    } finally {
      setSigningCert(false);
    }
  };

  const openPreview = (title: string, blob: Blob) => {
    setPreviewTitle(title);
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    setPreviewOpen(true);
  };

  // Cabeçalho comum aos documentos (paciente + médico + data + nº atendimento).
  const docMeta = () => ({
    patientName: consultation!.patient_name,
    doctorName: consultation!.doctor_name,
    doctorCrm: consultation!.doctor_crm,
    date: consultation!.date,
    consultationRef: consultation!.number ?? consultation!.id.slice(0, 8),
  });

  const handleGenerateReceita = async () => {
    if (!consultation) return;
    if (draftRef.current.medications.length === 0) {
      toast({ title: 'Receita vazia', description: 'Adicione ao menos um medicamento na aba Receita.', variant: 'destructive' });
      return;
    }
    try {
      const { blob } = await buildPrescriptionPdf({
        ...docMeta(),
        medications: prescriptionMeds(),
        guidance: draftRef.current.prescriptionGuidance,
        signature: null,
      });
      openPreview('Receita Médica', blob);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível gerar a receita.', variant: 'destructive' });
    }
  };

  const handleGenerateExame = async () => {
    if (!consultation) return;
    if (draftRef.current.examRequests.length === 0) {
      toast({ title: 'Sem exames', description: 'Adicione ao menos um exame na aba Exames.', variant: 'destructive' });
      return;
    }
    try {
      const { blob } = await buildExamRequestPdf({
        ...docMeta(),
        exams: draftRef.current.examRequests.map(e => ({ name: e.name, priority: e.priority, justification: e.justification })),
        draft: true,
      });
      openPreview('Pedido de Exames (rascunho)', blob);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível gerar o pedido de exames.', variant: 'destructive' });
    }
  };

  const handleGenerateAtestado = async () => {
    if (!consultation) return;
    const c = draftRef.current.certificate;
    if (!c || !c.days || !c.reason) {
      toast({ title: 'Atestado incompleto', description: 'Preencha dias e motivo na aba Atestado.', variant: 'destructive' });
      return;
    }
    try {
      const { blob } = await buildCertificatePdf({
        ...docMeta(),
        days: c.days, startDate: c.startDate, cidCode: c.cidCode, reason: c.reason, notes: c.notes,
        draft: true,
      });
      openPreview('Atestado Médico (rascunho)', blob);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível gerar o atestado.', variant: 'destructive' });
    }
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
      logEvent('doctor_finished_consultation', {
        consultationId: id,
        payload: {
          prescriptions: draftRef.current.medications.length,
          exam_requests: draftRef.current.examRequests.length,
          certificates: draftRef.current.certificate ? 1 : 0,
          signed: draftRef.current.signed,
        },
      });
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
  // Only surface the attendant's triage card when it actually carries content.
  const triageInfo = hasTriageContent(triage) ? triage : null;

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] lg:h-screen bg-slate-50">
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
              {format(new Date(consultation.date), "dd/MM/yyyy", { locale: ptBR })} · #{consultation.number ?? consultation.id.slice(0, 8)}
            </p>
          </div>
          {consultation.status === 'in_consultation' && (
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
              className="gap-1.5"
              onClick={() => setShowVideoPanel(true)}
            >
              <Video className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Iniciar Videochamada</span>
              <span className="sm:hidden">Vídeo</span>
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
        {/* Workspace */}
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
                {/* Signed indicator per document */}
                {tabId === 'receita' && draft.signed && <CheckCircle className="h-3 w-3 text-green-500 ml-1" />}
                {tabId === 'exames' && !!examDoc && <CheckCircle className="h-3 w-3 text-green-500 ml-1" />}
                {tabId === 'atestado' && !!certDoc && <CheckCircle className="h-3 w-3 text-green-500 ml-1" />}
              </button>
            ))}
          </div>

          {/* Safety strip — allergies + meds in use, always visible across all
              tabs (especially while prescribing). Allergies are loud in red. */}
          {intake && (
            <div className="bg-white border-b border-gray-200 px-5 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 shrink-0">
              {intake.alergias?.trim() ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Alergias: {intake.alergias.trim()}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Alergias: nenhuma informada
                </span>
              )}
              {intake.medicamentos?.trim() && (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
                  <Pill className="h-3.5 w-3.5 shrink-0" /> Em uso: {intake.medicamentos.trim()}
                </span>
              )}
            </div>
          )}

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                  {TABS.find(t => t.id === activeTab)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!consultation.doctor_crm?.trim() && (
                  <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-sm text-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      CRM não cadastrado. Os documentos não terão validade até você concluir o cadastro em{' '}
                      <button className="font-semibold underline" onClick={() => navigate('/medico/configuracoes?tab=crm')}>
                        Configurações › CRM/RQE
                      </button>.
                    </span>
                  </div>
                )}
                {isCompleted && (
                  <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2 text-sm text-blue-700">
                    <FileText className="h-4 w-4 shrink-0" />
                    Consulta concluída — você pode revisar e emitir os documentos (receita, exames, atestado).
                  </div>
                )}

                {activeTab === 'paciente' && (
                  <div className="space-y-4">
                    {/* Identidade — dados do paciente (não do médico) */}
                    <div className="flex items-center gap-4 p-4 rounded-xl border bg-white">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-7 w-7 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{consultation.patient_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Paciente · {format(new Date(consultation.date), "dd/MM/yyyy", { locale: ptBR })} · #{consultation.number ?? consultation.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>

                    {/* Triagem: informações iniciais escritas pelo atendente */}
                    {triageInfo && <TriageInfoCard triage={triageInfo} />}

                    {/* Atalho: a pré-consulta enviada pelo paciente fica na aba Anamnese */}
                    <p className="text-xs text-muted-foreground">
                      As informações enviadas pelo paciente (queixa, sintomas, alergias, medicamentos em uso) estão na aba{' '}
                      <button className="font-medium text-primary underline" onClick={() => setActiveTab('anamnese')}>Anamnese</button>.
                    </p>

                    {/* Documentos desta consulta */}
                    <div className="rounded-xl border bg-white p-4">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Documentos desta consulta</p>
                      <div className="grid grid-cols-2 gap-x-6">
                        <SummaryItem label="Medicamentos" count={draft.medications.length} icon={FileText} />
                        <SummaryItem label="Exames" count={draft.examRequests.length} icon={FlaskConical} />
                        <SummaryItem label="Atestado" count={draft.certificate ? 1 : 0} icon={ClipboardCheck} />
                        <SummaryItem label="Assinados" count={(draft.signed ? 1 : 0) + (examDoc ? 1 : 0) + (certDoc ? 1 : 0)} icon={PenLine} />
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'anamnese' && (
                  <AnamneseTab
                    value={draft.anamnese}
                    onChange={v => updateDraft({ anamnese: v })}
                    intake={intake}
                    triage={triageInfo}
                  />
                )}
                {activeTab === 'receita' && (
                  <>
                    <ReceitaTab
                      medications={draft.medications}
                      guidance={draft.prescriptionGuidance ?? ''}
                      onAdd={m => updateDraft({ medications: [...draft.medications, m] })}
                      onRemove={rmId => updateDraft({ medications: draft.medications.filter(m => m.id !== rmId) })}
                      onGuidanceChange={v => updateDraft({ prescriptionGuidance: v })}
                      locked={draft.signed}
                      onReopen={handleReopenReceita}
                    />
                    <DocumentActionFooter
                      ready={draft.medications.length > 0}
                      hint="Adicione ao menos um medicamento para assinar."
                      signed={draft.signed}
                      signedAt={draft.signedAt}
                      signing={signing}
                      pdfUrl={signedPdfUrl}
                      onPreview={handleGenerateReceita}
                      onPrint={printReceita}
                      onSign={handleSignPrescription}
                    />
                  </>
                )}
                {activeTab === 'exames' && (
                  <>
                    <ExamesTab
                      exams={draft.examRequests}
                      onAdd={e => updateDraft({ examRequests: [...draft.examRequests, e] })}
                      onRemove={rmId => updateDraft({ examRequests: draft.examRequests.filter(e => e.id !== rmId) })}
                    />
                    <DocumentActionFooter
                      ready={draft.examRequests.length > 0}
                      hint="Adicione ao menos um exame para assinar."
                      signed={!!examDoc}
                      signedAt={examDoc?.signed_at ?? null}
                      signing={signingExam}
                      pdfUrl={examPdfUrl}
                      onPreview={handleGenerateExame}
                      onPrint={printExames}
                      onSign={handleSignExame}
                      canResign
                    />
                  </>
                )}
                {activeTab === 'atestado' && (
                  <>
                    <AtestadoTab
                      cert={draft.certificate}
                      onChange={c => updateDraft({ certificate: c })}
                    />
                    <DocumentActionFooter
                      ready={!!draft.certificate?.days && !!draft.certificate?.reason}
                      hint="Preencha dias e motivo para assinar."
                      signed={!!certDoc}
                      signedAt={certDoc?.signed_at ?? null}
                      signing={signingCert}
                      pdfUrl={certPdfUrl}
                      onPreview={handleGenerateAtestado}
                      onPrint={printAtestado}
                      onSign={handleSignAtestado}
                      canResign
                    />
                  </>
                )}

                {/* Assinatura em modo demonstração (sem validade jurídica) */}
                {(activeTab === 'receita' || activeTab === 'exames' || activeTab === 'atestado') && (
                  <p className="mt-3 text-[11px] text-muted-foreground/70 flex items-start gap-1.5">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    Assinatura em modo demonstração — sem validade jurídica. Em produção, validade legal via ICP-Brasil.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Save indicator — reflects the real persistence state */}
            <div className="flex items-center gap-1.5 mt-3 text-xs">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Salvo{lastSavedAt ? ` às ${format(lastSavedAt, 'HH:mm')}` : ''}
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-red-600">
                  <AlertCircle className="h-3 w-3" /> Falha ao salvar.
                  <button onClick={retrySave} className="underline font-medium">Tentar novamente</button>
                </span>
              )}
              {saveStatus === 'idle' && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Save className="h-3 w-3" />
                  {isCompleted ? 'Alterações salvas automaticamente' : 'Salvo automaticamente durante o atendimento'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating video window — only while the consultation is open (CARD-05) */}
      {showVideoPanel && id && consultation && consultation.status === 'in_consultation' && (
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

      {/* Pré-visualização da receita (PDF) */}
      <Dialog
        open={previewOpen}
        onOpenChange={(o) => {
          setPreviewOpen(o);
          if (!o) setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe title={previewTitle} src={previewUrl} className="w-full h-[70vh] rounded-md border" />
          )}
          <DialogFooter>
            {previewUrl && (
              <Button asChild variant="outline">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" /> Abrir em nova aba
                </a>
              </Button>
            )}
            <Button onClick={() => setPreviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
