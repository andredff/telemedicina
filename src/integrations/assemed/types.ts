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
  /** Token do paciente para entrar na sala de atendimento — embutido no JWT do login-externo */
  pacienteToken?: string;
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
  pacienteId: number;
  apenasDisponiveis: boolean;
  requerAgendamento: boolean;
}

export interface GetSpecialtiesResponse {
  items: Specialty[];
  totalCount?: number;
}

// ==========================================
// ATENDIMENTOS
// ==========================================

export interface AnamneseResposta {
  perguntaQuestionarioAnamneseId: number;
  opcoesRespondidas: { opcoesPerguntaQuestionarioAnamneseId: number }[];
  texto: string;
}

export interface CreateConsultationRequest {
  dataAgendamento?: string; // ISO datetime, obrigatório para tipoAtendimento = 3
  especialidadeId: number;
  pacienteId: number;
  profissionalId?: number;
  profissionalAgendamentoId?: number; // ID do slot de agendamento selecionado
  tipoAtendimento: number; // 1 = imediato, 3 = agendamento
  formatoAtendimento?: number;
  atendimentoVinculadoId?: number;
  respostasAnamnese?: AnamneseResposta[];
  exames?: { arquivoBase64: string }[];
  cupomCodigo?: string;
  textoPerguntaPaciente?: string;
  fusoUsuario?: number;
  tipoProfissional?: number;
  /** Token do paciente extraído do JWT do login-externo */
  pacienteToken?: string;
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
  profissionalAgendamentoNome?: string | null; // Nome do médico agendado (consultas tipoAtendimento = 3)
  status: ConsultationStatus;
  situacao?: ConsultationStatus; // Alias para compatibilidade com API
  situacaoAtendimentoDescricao?: string; // Descrição textual do status vinda da API
  motivoCancelamentoDescricao?: string;  // Descrição do motivo de cancelamento (ex: "Concluído")
  dataHoraCriacao?: string;
  dataCriacao?: string; // Alias alternativo da API
  dataHoraInicio: string | null;
  dataHoraFim: string | null;
  pacienteToken: string | null;
  dataAgendamento?: string;  // Preenchido para consultas agendadas (tipoAtendimento = 3)
  tipoAtendimento?: number;  // 1 = imediato, 3 = agendado com especialista
}

/**
 * Normaliza status da consulta para enum ConsultationStatus
 * A API pode retornar em diferentes formatos
 */
export function normalizeConsultationStatus(consultation: Consultation): ConsultationStatus {
  // Override: cancelamento com motivo "Concluído" é tratado como consulta concluída
  const motivoConcluido = consultation.motivoCancelamentoDescricao === "Concluído";
  if (motivoConcluido) return 'CONCLUIDO';

  const validStatuses: ConsultationStatus[] = ['AGUARDANDO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'CANCELADO'];

  // Tenta campos diretos, mas só aceita se for um valor enum válido
  if (consultation.status && validStatuses.includes(consultation.status)) return consultation.status;
  if (consultation.situacao && validStatuses.includes(consultation.situacao)) return consultation.situacao;

  // Normaliza qualquer string textual para enum (status, situacao ou descrição)
  const raw = String(
    consultation.situacaoAtendimentoDescricao || consultation.situacao || consultation.status || ''
  ).toLowerCase();

  if (raw.includes('cancelad')) return 'CANCELADO';
  if (raw.includes('conclu') || raw.includes('finaliz')) return 'CONCLUIDO';
  // Verificar "aguard" ANTES de "atendimento" pois "Aguardando atendimento" contém ambos
  if (raw.includes('aguard') || raw.includes('espera')) return 'AGUARDANDO';
  if (raw.includes('em atendimento') || raw.includes('andamento')) return 'EM_ATENDIMENTO';

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
// AGENDAMENTO DE ESPECIALISTAS
// ==========================================

export interface AvailableProfessional {
  profissionalId: number;
  /** Nome do profissional — API pode retornar como profissionalNome */
  nome: string;
  especialidadeId?: number;
  especialidadeNome?: string;
  profissionalPrecoConsulta?: number | null;
  profissionalTempoConsulta?: number;
  disponibilidade?: unknown;
  foto?: string | null;
}

export interface ScheduleSlot {
  id: number;
  profissionalId: number;
  profissionalNome: string;
  dataHora: string; // ISO datetime
  precoConsulta: number;
}

export interface AvailableScheduleDay {
  data: string; // ISO date (YYYY-MM-DD)
  horarios: ScheduleSlot[];
}

export interface GetAvailableSchedulesRequest {
  profissionalId: number | null;
  pacienteId: number;
  dataInicio: string | null;
  dataFim: string | null;
  horaInicio: string | null;
  horaFim: string | null;
  especialidadeId: number;
  fuso: number;
}

export interface GetAvailableProfessionalsResponse {
  items: AvailableProfessional[];
}

export interface GetAvailableSchedulesResponse {
  items: AvailableScheduleDay[];
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

/** Item retornado por GET /api/Atendimentos/{id}/receituario */
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
