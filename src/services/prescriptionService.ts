// Persistência da receita médica de 1ª classe (tabela consultation_prescriptions
// + PDF assinado no bucket privado consulta-receitas).
//
// A tabela é nova e ainda não está nos tipos gerados do Supabase, então usamos
// `(supabase as any)` — mesmo padrão de consultation_credits.

import { supabase } from '@/integrations/supabase/client';
import { logEvent } from '@/lib/audit';
import { buildPrescriptionPdf, type PrescriptionMedication } from '@/components/prescription/PrescriptionPdf';
import { signPrescription } from '@/services/signatureService';

const BUCKET = 'consulta-receitas';
const SIGNED_URL_TTL_S = 3600;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface SignPrescriptionArgs {
  consultationId: string;
  patientName: string;
  doctor: { name: string; crm: string };
  date: string; // ISO
  consultationRef?: string | number | null;
  medications: PrescriptionMedication[];
  guidance?: string;
}

export interface PrescriptionRecord {
  id: string;
  consultation_id: string;
  patient_id: string | null;
  doctor_name: string | null;
  doctor_crm: string | null;
  medications: PrescriptionMedication[];
  guidance: string | null;
  status: 'draft' | 'signed';
  pdf_path: string | null;
  signature_provider: 'stub' | 'bird_id' | null;
  signature_id: string | null;
  signed_at: string | null;
  created_at: string;
  // join opcional com a consulta (para o histórico do médico)
  consultations?: { patient_name: string | null; date: string | null; number: number | null } | null;
}

function pdfPath(consultationId: string) {
  return `${consultationId}/receita.pdf`;
}

/**
 * Gera o PDF, assina (stub/Bird ID), sobe o PDF assinado e faz upsert do registro.
 * Uma receita por consulta (upsert por consultation_id).
 */
export async function signAndStorePrescription(args: SignPrescriptionArgs): Promise<PrescriptionRecord> {
  // 1. Documento não assinado → assinatura (hash + id da transação).
  const unsigned = await buildPrescriptionPdf({
    patientName: args.patientName,
    doctorName: args.doctor.name,
    doctorCrm: args.doctor.crm,
    date: args.date,
    consultationRef: args.consultationRef,
    medications: args.medications,
    guidance: args.guidance,
    signature: null,
  });

  const signature = await signPrescription({
    pdfBytes: unsigned.bytes,
    consultationId: args.consultationId,
    doctor: args.doctor,
  });

  // 2. Documento final, já com o carimbo de assinatura embutido.
  const signed = await buildPrescriptionPdf({
    patientName: args.patientName,
    doctorName: args.doctor.name,
    doctorCrm: args.doctor.crm,
    date: args.date,
    consultationRef: args.consultationRef,
    medications: args.medications,
    guidance: args.guidance,
    signature,
  });

  // 3. Upload no bucket privado (pasta = consultationId).
  const path = pdfPath(args.consultationId);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, signed.blob, { upsert: true, contentType: 'application/pdf' });
  if (upErr) throw upErr;

  // 4. Resolve paciente (dono da consulta) e médico (usuário logado).
  const [{ data: consultation }, { data: auth }] = await Promise.all([
    supabase.from('consultations').select('user_id').eq('id', args.consultationId).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const row = {
    consultation_id: args.consultationId,
    patient_id: (consultation as { user_id?: string } | null)?.user_id ?? null,
    doctor_id: auth?.user?.id ?? null,
    doctor_name: args.doctor.name,
    doctor_crm: args.doctor.crm,
    medications: args.medications,
    guidance: args.guidance ?? null,
    status: 'signed' as const,
    pdf_path: path,
    signature_provider: signature.provider,
    signature_id: signature.signatureId,
    signature_hash: signature.hash,
    signed_at: signature.signedAt,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('consultation_prescriptions')
    .upsert(row, { onConflict: 'consultation_id' })
    .select()
    .single();
  if (error) throw error;

  // Auditoria (sem nomes de medicamentos/paciente — só contagens/ids).
  logEvent('prescription_signed', {
    consultationId: args.consultationId,
    payload: { provider: signature.provider, medications: args.medications.length },
  });

  return data as PrescriptionRecord;
}

/** Receita já registrada para uma consulta (ou null). */
export async function getPrescriptionByConsultation(
  consultationId: string,
): Promise<PrescriptionRecord | null> {
  const { data } = await db
    .from('consultation_prescriptions')
    .select('*')
    .eq('consultation_id', consultationId)
    .maybeSingle();
  return (data as PrescriptionRecord) ?? null;
}

/** Histórico do médico/admin (RLS restringe ao que ele pode ver). */
export async function listPrescriptions(): Promise<PrescriptionRecord[]> {
  const { data, error } = await db
    .from('consultation_prescriptions')
    .select('*, consultations(patient_name, date, number)')
    .order('signed_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as PrescriptionRecord[]) ?? [];
}

/** Signed URL de curta duração para baixar/ver o PDF assinado. */
export async function getSignedPrescriptionUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_S);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
