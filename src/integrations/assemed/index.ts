// Cliente principal
export { assemedClient, AssemedApiError } from "./client";

// Mock client (para testes)
export { assemedMockClient } from "./mockClient";

// Configurações e URLs
export {
  getAssemedCredentials,
  getAssemedUrls,
  getWaitingRoomUrl,
  hasCredentials,
  TELEMEDICINA_IFRAME_URL,
} from "./config";

// Tipos
export type {
  // Identificação
  ClientIdentification,
  AssemedConfig,
  AssemedUrls,
  // Paciente
  RegisterPatientRequest,
  RegisterPatientResponse,
  Patient,
  // Autenticação
  LoginRequest,
  LoginResponse,
  DecodedToken,
  // Especialidades
  Specialty,
  GetSpecialtiesRequest,
  GetSpecialtiesResponse,
  // Atendimentos
  CreateConsultationRequest,
  CreateConsultationResponse,
  Consultation,
  ConsultationStatus,
  GetConsultationsRequest,
  GetConsultationsResponse,
  ConsultationSimplified,
  // Receituários
  Prescription,
  GetPrescriptionsResponse,
  // Avaliação
  EvaluationRequest,
  // Erros
  AssemedError,
} from "./types";
