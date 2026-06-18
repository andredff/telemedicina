// Persistência de PEDIDO DE EXAME e ATESTADO assinados na teleconsulta
// (tabela consultation_documents + PDF assinado no bucket privado consulta-receitas).
//
// Espelha prescriptionService.ts. A tabela é nova e ainda não está nos tipos
// gerados do Supabase, então usamos `(supabase as any)` — mesmo padrão da receita.

import { supabase } from '@/integrations/supabase/client';
import { logEvent } from '@/lib/audit';
import { signDocument } from '@/services/signatureService';
import {
  buildExamRequestPdf, buildCertificatePdf, type ExamItem,
} from '@/components/documents/MedicalDocsPdf';

const BUCKET = 'consulta-receitas';
const SIGNED_URL_TTL_S = 3600;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ConsultationDocType = 'exam_request' | 'certificate';

export interface ConsultationDocumentRecord {
  id: string;
  consultation_id: string;
  patient_id: string | null;
  doctor_name: string | null;
  doctor_crm: string | null;
  doc_type: ConsultationDocType;
  content: Record<string, unknown>;
  status: 'draft' | 'signed';
  pdf_path: string | null;
  signature_provider: 'stub' | 'bird_id' | null;
  signature_id: string | null;
  signed_at: string | null;
  created_at: string;
}

interface DocMeta {
  consultationId: string;
  patientName: string;
  doctor: { name: string; crm: string };
  date: string; // ISO
  consultationRef?: string | number | null;
}

function docFile(docType: ConsultationDocType) {
  return docType === 'exam_request' ? 'exame.pdf' : 'atestado.pdf';
}
function docPath(consultationId: string, docType: ConsultationDocType) {
  return `${consultationId}/${docFile(docType)}`;
}

/** Assina os bytes, sobe o PDF e faz upsert do registro (um por consulta+tipo). */
async function persistSigned(params: {
  consultationId: string;
  docType: ConsultationDocType;
  doctor: { name: string; crm: string };
  content: Record<string, unknown>;
  pdf: { blob: Blob; bytes: Uint8Array };
}): Promise<ConsultationDocumentRecord> {
  const signature = await signDocument({
    pdfBytes: params.pdf.bytes,
    consultationId: params.consultationId,
    doctor: params.doctor,
  });

  const path = docPath(params.consultationId, params.docType);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, params.pdf.blob, { upsert: true, contentType: 'application/pdf' });
  if (upErr) throw upErr;

  const [{ data: consultation }, { data: auth }] = await Promise.all([
    db.from('consultations').select('user_id').eq('id', params.consultationId).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const row = {
    consultation_id: params.consultationId,
    patient_id: (consultation as { user_id?: string } | null)?.user_id ?? null,
    doctor_id: auth?.user?.id ?? null,
    doctor_name: params.doctor.name,
    doctor_crm: params.doctor.crm,
    doc_type: params.docType,
    content: params.content,
    status: 'signed' as const,
    pdf_path: path,
    signature_provider: signature.provider,
    signature_id: signature.signatureId,
    signature_hash: signature.hash,
    signed_at: signature.signedAt,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('consultation_documents')
    .upsert(row, { onConflict: 'consultation_id,doc_type' })
    .select()
    .single();
  if (error) throw error;

  logEvent('document_signed', {
    consultationId: params.consultationId,
    payload: { doc_type: params.docType, provider: signature.provider },
  });

  return data as ConsultationDocumentRecord;
}

/** Gera o PDF do pedido de exame, assina e armazena. */
export async function signAndStoreExamRequest(
  meta: DocMeta & { exams: ExamItem[] },
): Promise<ConsultationDocumentRecord> {
  const pdf = await buildExamRequestPdf({
    patientName: meta.patientName,
    doctorName: meta.doctor.name,
    doctorCrm: meta.doctor.crm,
    date: meta.date,
    consultationRef: meta.consultationRef,
    exams: meta.exams,
  });
  return persistSigned({
    consultationId: meta.consultationId,
    docType: 'exam_request',
    doctor: meta.doctor,
    content: { exams: meta.exams },
    pdf,
  });
}

export interface CertificateContent {
  days: string;
  startDate: string;
  cidCode?: string;
  reason: string;
  notes?: string;
}

/** Gera o PDF do atestado, assina e armazena. */
export async function signAndStoreCertificate(
  meta: DocMeta & CertificateContent,
): Promise<ConsultationDocumentRecord> {
  const pdf = await buildCertificatePdf({
    patientName: meta.patientName,
    doctorName: meta.doctor.name,
    doctorCrm: meta.doctor.crm,
    date: meta.date,
    consultationRef: meta.consultationRef,
    days: meta.days,
    startDate: meta.startDate,
    cidCode: meta.cidCode,
    reason: meta.reason,
    notes: meta.notes,
  });
  return persistSigned({
    consultationId: meta.consultationId,
    docType: 'certificate',
    doctor: meta.doctor,
    content: {
      days: meta.days, startDate: meta.startDate, cidCode: meta.cidCode,
      reason: meta.reason, notes: meta.notes,
    },
    pdf,
  });
}

/** Documentos (exame/atestado) registrados para uma consulta. RLS restringe o acesso. */
export async function getConsultationDocuments(
  consultationId: string,
): Promise<ConsultationDocumentRecord[]> {
  const { data } = await db
    .from('consultation_documents')
    .select('*')
    .eq('consultation_id', consultationId);
  return (data as ConsultationDocumentRecord[]) ?? [];
}

/** Signed URL de curta duração para baixar/ver o PDF assinado. */
export async function getSignedDocumentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_S);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
