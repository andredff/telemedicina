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
  dataHoraCriacao: string;
  dataHoraInicio: string | null;
  dataHoraFim: string | null;
  pacienteToken: string;
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
  profissionalNome: string | null;
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
