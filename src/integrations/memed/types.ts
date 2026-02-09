/**
 * Tipos para integração com Memed (Prescrição Digital)
 * https://memed.com.br
 */

export interface MemedPrescription {
  id: string;
  token: string;
  patient: MemedPatient;
  doctor: MemedDoctor;
  medications: MemedMedication[];
  status: "active" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
}

export interface MemedPatient {
  id: string;
  name: string;
  cpf: string;
  email?: string;
  phone?: string;
}

export interface MemedDoctor {
  id: string;
  name: string;
  crm: string;
  specialty?: string;
}

export interface MemedMedication {
  id: string;
  name: string;
  dosage: string;
  quantity: number;
  frequency: string;
  duration: string;
  active_ingredient: string;
  manufacturer?: string;
  ean?: string;
}

export interface MemedSearchParams {
  token?: string;
  prescriptionId?: string;
  patientCpf?: string;
}

export interface MemedSearchResult {
  success: boolean;
  prescription: MemedPrescription | null;
  message?: string;
}

export interface MemedConfig {
  apiKey: string;
  secretToken: string;
  isSandbox: boolean;
}
