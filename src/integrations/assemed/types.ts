// ==========================================
// TIPOS DA API ASSEMED TELEMEDICINA
// ==========================================

// Identificação do cliente para autenticação
export interface ClientIdentification {
  clientId: string;
  clientSecret: string;
}

// ==========================================
// PACIENTE
// ==========================================

export interface RegisterPatientRequest {
  identificacao: ClientIdentification;
  nome: string;
  cpf: string;
  cnpj: string;
  dataNascimento: string; // ISO 8601
  sexo: "M" | "F";
  telefone: string;
  email: string;
}

export interface RegisterPatientResponse {
  pacienteId: number;
}

export interface Patient {
  id: number;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  dataNascimento: string;
  sexo: "M" | "F";
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================

export interface LoginRequest {
  cpfPaciente: string;
  clientId: string;
  clientSecret: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  prazoMaximoAssumirAtendimento: number;
}

export interface DecodedToken {
  usuarioId: string;
  pacienteId: string;
  nome: string;
  email: string;
  perfil: string;
  cliente: string;
  exp: number;
}

// ==========================================
// ESPECIALIDADES
// ==========================================

export interface Specialty {
  id: number;
  nome: string;
  icone: string;
  tipoIcone: "arquivo" | "url";
  precoConsulta: number;
  valorRepasseProfissional: number;
  tipoProfissionalId: number;
  tipoProfissionalDescricao: string;
  especialidadeIdMemed: number;
  segundaOpcaoEspecialidadeId: number | null;
  segundaOpcaoEspecialidadeNome: string | null;
  permiteCriacaoAtendimentoPeloPaciente: boolean;
  triagem: boolean;
  contratoPadraoId: number;
  contratoPadraoNome: string | null;
}

export interface GetSpecialtiesRequest {
  pageSize: number;
  pageIndex: number;
}

export interface GetSpecialtiesResponse {
  items: Specialty[];
  totalCount?: number;
}

// ==========================================
// ATENDIMENTOS
// ==========================================

export interface CreateConsultationRequest {
  tipoAtendimento: number; // Sempre 1 para primeira consulta
  tipoProfissional: number;
  especialidadeId: number;
  pacienteId: number;
  exames?: { arquivoBase64: string }[];
}

export interface CreateConsultationResponse {
  id: number;
  pacienteToken: string;
  usuarioIdProximoProfissional: number | null;
  existePacienteAguardandoSemProfissional: boolean;
  existeAtendimentoTextoAguardando: boolean;
  pacienteNome: string;
  tituloAssinatura: string;
  cupom: string | null;
  pendingBillingSessionSecret: string | null;
}

export type ConsultationStatus =
  | "AGUARDANDO"
  | "EM_ATENDIMENTO"
  | "CONCLUIDO"
  | "CANCELADO";

export interface Consultation {
  id: number;
  pacienteId: number;
  pacienteNome: string;
  especialidadeId: number;
  especialidadeNome: string;
  tipoProfissionalId: number;
  profissionalNome: string | null;
  status: ConsultationStatus;
  situacao?: ConsultationStatus; // Alias para compatibilidade com API
  situacaoAtendimentoDescricao?: string; // Descrição textual do status vinda da API
  dataHoraCriacao: string;
  dataHoraInicio: string | null;
  dataHoraFim: string | null;
  pacienteToken: string | null;
}

/**
 * Normaliza status da consulta para enum ConsultationStatus
 * A API pode retornar em diferentes formatos
 */
export function normalizeConsultationStatus(consultation: Consultation): ConsultationStatus {
  // Primeiro tenta campos diretos
  if (consultation.status) return consultation.status;
  if (consultation.situacao) return consultation.situacao;
  
  // Normaliza descrição textual para enum
  const desc = consultation.situacaoAtendimentoDescricao?.toLowerCase();
  if (desc) {
    if (desc.includes('cancelad')) return 'CANCELADO';
    if (desc.includes('conclu') || desc.includes('finaliz')) return 'CONCLUIDO';
    // Verificar "aguard" ANTES de "atendimento" pois "Aguardando atendimento" contém ambos
    if (desc.includes('aguard') || desc.includes('espera')) return 'AGUARDANDO';
    if (desc.includes('em atendimento') || desc.includes('andamento')) return 'EM_ATENDIMENTO';
  }
  
  return 'AGUARDANDO';
}

export interface GetConsultationsRequest {
  pageIndex: number;
  pageSize: number;
}

export interface GetConsultationsResponse {
  items: Consultation[];
  totalCount?: number;
}

export interface ConsultationSimplified {
  id: number;
  situacao: ConsultationStatus;
  situacaoAtendimentoDescricao?: string; // A API pode retornar descrição textual
  profissionalNome: string | null;
  /** Motivo do cancelamento (quando situacao = CANCELADO)
   * 4 = Cancelado por timeout (não queima crédito)
   */
  motivoCancelamento?: number;
}

/**
 * Normaliza status simplificado da consulta para enum ConsultationStatus
 * A API pode retornar em diferentes formatos (enum ou descrição textual)
 */
export function normalizeSimplifiedStatus(simplified: ConsultationSimplified): ConsultationStatus {
  // Primeiro tenta o campo situacao direto se for enum válido
  const validStatuses: ConsultationStatus[] = ['AGUARDANDO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'CANCELADO'];
  if (simplified.situacao && validStatuses.includes(simplified.situacao)) {
    return simplified.situacao;
  }
  
  // Tenta normalizar como string (pode vir "Aguardando atendimento", etc)
  const situacaoStr = String(simplified.situacao || simplified.situacaoAtendimentoDescricao || '').toLowerCase();
  
  if (situacaoStr.includes('cancelad')) return 'CANCELADO';
  if (situacaoStr.includes('conclu') || situacaoStr.includes('finaliz')) return 'CONCLUIDO';
  if (situacaoStr.includes('aguard') || situacaoStr.includes('espera')) return 'AGUARDANDO';
  if (situacaoStr.includes('em atendimento') || situacaoStr.includes('andamento')) return 'EM_ATENDIMENTO';
  
  return 'AGUARDANDO';
}

// ==========================================
// RECEITUÁRIOS E DOCUMENTOS
// ==========================================

export interface Prescription {
  id: number;
  tipo: "RECEITA" | "ATESTADO" | "EXAME";
  url: string;
  dataCriacao: string;
}

/** Item retornado por GET /api/Atendimentos/v2/{id}/receituario */
export interface ReceituarioItem {
  urlPdf: string;
}

export interface GetPrescriptionsResponse {
  items: Prescription[];
}

// ==========================================
// AVALIAÇÃO
// ==========================================

export interface EvaluationRequest {
  nota: number; // 1-5
  comentario?: string;
}

// ==========================================
// ERROS
// ==========================================

export interface AssemedError {
  code: string;
  message: string;
  details?: string;
}

// ==========================================
// CONFIGURAÇÕES
// ==========================================

export interface AssemedConfig {
  clientId: string;
  clientSecret: string;
  cnpj: string;
  isSandbox: boolean;
}

export interface AssemedUrls {
  apiUrl: string;
  appUrl: string;
}
