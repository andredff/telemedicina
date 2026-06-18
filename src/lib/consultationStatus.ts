// Canonical teleconsultation lifecycle.
// Source of truth: supabase/migrations/20260619000000_consultation_triage.sql
//
//   waiting_attendant → with_attendant → waiting_doctor
//      → routed_to_doctor → in_consultation → completed
//      (cancelled from any pre-consultation stage)
//
// Legacy rows used 'pending' (→ waiting_doctor) and 'in_progress' (→ in_consultation);
// normalizeStatus() maps those so old payloads/rows keep working during the cutover.

export type ConsultationStatus =
  | 'waiting_attendant'
  | 'with_attendant'
  | 'waiting_doctor'
  | 'routed_to_doctor'
  | 'in_consultation'
  | 'completed'
  | 'cancelled';

export const CStatus = {
  WAITING_ATTENDANT: 'waiting_attendant',
  WITH_ATTENDANT: 'with_attendant',
  WAITING_DOCTOR: 'waiting_doctor',
  ROUTED_TO_DOCTOR: 'routed_to_doctor',
  IN_CONSULTATION: 'in_consultation',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

/** Map legacy status values onto the canonical vocabulary. */
export function normalizeStatus(s?: string | null): ConsultationStatus {
  switch (s) {
    case 'pending':     return 'waiting_doctor';
    case 'in_progress': return 'in_consultation';
    default:            return (s ?? 'waiting_attendant') as ConsultationStatus;
  }
}

/** Pre-consultation waiting stages — patient sees a "waiting" UI. */
export const WAITING_STATUSES: ConsultationStatus[] = [
  'waiting_attendant', 'with_attendant', 'waiting_doctor', 'routed_to_doctor',
];

/** Patient is mid-flow (anything not finished/cancelled). */
export const ACTIVE_STATUSES: ConsultationStatus[] = [...WAITING_STATUSES, 'in_consultation'];

export function isWaiting(s?: string | null): boolean {
  return WAITING_STATUSES.includes(normalizeStatus(s));
}

export function isActive(s?: string | null): boolean {
  return ACTIVE_STATUSES.includes(normalizeStatus(s));
}

/** True once the medical act is live (doctor accepted / in call). */
export function isInCall(s?: string | null): boolean {
  const n = normalizeStatus(s);
  return n === 'routed_to_doctor' || n === 'in_consultation';
}

/** Short, patient-facing label for "who is attending me right now". */
export function patientStageLabel(s?: string | null): string {
  switch (normalizeStatus(s)) {
    case 'waiting_attendant': return 'Aguardando atendente';
    case 'with_attendant':    return 'Falando com atendente';
    case 'waiting_doctor':    return 'Aguardando médico';
    case 'routed_to_doctor':  return 'Médico chamando você';
    case 'in_consultation':   return 'Em consulta';
    case 'completed':         return 'Consulta finalizada';
    case 'cancelled':         return 'Consulta cancelada';
  }
}
