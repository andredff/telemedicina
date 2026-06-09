// Shared helpers for the teleconsultation clinical draft.
//
// During a teleconsultation the doctor fills anamnese, prescription, exam
// requests and a certificate inside MedicoAtendimento. That draft is persisted
// in localStorage under `novita_draft_<consultationId>` (demo persistence).
// The patient detail page reads the same key to surface those documents.

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DraftMedication {
  id: string;
  name: string;
  dosage: string;
  quantity: string;
  instructions: string;
}

export interface DraftExamRequest {
  id: string;
  name: string;
  justification: string;
  priority: 'routine' | 'urgent' | 'emergency';
}

export interface DraftCertificate {
  days: string;
  startDate: string;
  cidCode: string;
  reason: string;
  notes: string;
}

export interface ConsultaDraft {
  anamnese: string;
  medications: DraftMedication[];
  examRequests: DraftExamRequest[];
  certificate: DraftCertificate | null;
  signed: boolean;
  signedAt: string | null;
}

// ─── Patient pre-consultation intake (intake_data column) ─────────────────────

export interface IntakeExam {
  name: string;
  url: string;
}

export interface IntakeData {
  sintomas: string[];
  sintomaPrincipal: string | null;
  medicamentos: string;
  exames: IntakeExam[];
  submittedAt: string;
}

export function intakeHasContent(d: IntakeData | null | undefined): boolean {
  if (!d) return false;
  return (
    d.sintomas.length > 0 ||
    !!d.medicamentos?.trim() ||
    d.exames.length > 0
  );
}

export function loadConsultaDraft(id: string): ConsultaDraft | null {
  try {
    const raw = localStorage.getItem(`novita_draft_${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as ConsultaDraft;
  } catch {
    return null;
  }
}

/** Whether the draft contains at least one emitted document. */
export function draftHasDocuments(d: ConsultaDraft | null): boolean {
  if (!d) return false;
  return d.medications.length > 0 || d.examRequests.length > 0 || !!d.certificate;
}

// ─── Printing ───────────────────────────────────────────────────────────────

interface PrintMeta {
  doctorName: string;
  doctorCrm: string;
  patientName: string;
  date: string;
}

function fmtDate(d: string) {
  try { return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
}

function printMedicalDocument(title: string, content: string, meta: PrintMeta) {
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
</head><body onload="window.print()">
  <div class="header">
    <div><h2>Novità Telemedicina</h2><p>Home Care & Teleconsulta</p></div>
    <div style="text-align:right;font-size:12px;color:#555">
      <p>${fmtDate(meta.date)}</p>
    </div>
  </div>
  <h1>${title}</h1>
  <div class="patient-box"><strong>Paciente:</strong> ${meta.patientName}</div>
  <div class="content">${content}</div>
  <div class="signature">
    <div class="sig-name">${meta.doctorName}</div>
    <div class="sig-crm">${meta.doctorCrm}</div>
  </div>
</body></html>`);
  w.document.close();
}

export function printReceita(meds: DraftMedication[], meta: PrintMeta) {
  const content = meds.map((m, i) => `<div class="item"><strong>${i + 1}. ${m.name}</strong>
    ${m.dosage ? `<p>Posologia: ${m.dosage}</p>` : ''}
    ${m.quantity ? `<p>Quantidade: ${m.quantity}</p>` : ''}
    ${m.instructions ? `<p>Obs: ${m.instructions}</p>` : ''}
  </div>`).join('');
  printMedicalDocument('Receita Médica', content, meta);
}

export function printExames(exams: DraftExamRequest[], meta: PrintMeta) {
  const content = exams.map((e) => `<div class="item"><strong>${e.name}</strong>
    <p>Prioridade: ${e.priority === 'routine' ? 'Rotina' : e.priority === 'urgent' ? 'Urgente' : 'Emergência'}</p>
    ${e.justification ? `<p>Justificativa: ${e.justification}</p>` : ''}
  </div>`).join('');
  printMedicalDocument('Pedido de Exames', content, meta);
}

export function printAtestado(cert: DraftCertificate, meta: PrintMeta) {
  const content = `
    <div class="item">
      <p>Atesto que o(a) paciente <strong>${meta.patientName}</strong> necessita de afastamento
      de suas atividades pelo período de <strong>${cert.days} dia${Number(cert.days) > 1 ? 's' : ''}</strong>,
      a partir de ${fmtDate(cert.startDate)}.</p>
      ${cert.cidCode ? `<p><strong>CID-10:</strong> ${cert.cidCode}</p>` : ''}
      <p><strong>Diagnóstico:</strong> ${cert.reason}</p>
      ${cert.notes ? `<p><strong>Observações:</strong> ${cert.notes}</p>` : ''}
    </div>`;
  printMedicalDocument('Atestado Médico', content, meta);
}
