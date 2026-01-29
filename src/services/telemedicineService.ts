import {
  assemedClient,
  getWaitingRoomUrl,
  getAssemedCredentials,
  TELEMEDICINA_IFRAME_URL,
} from "@/integrations/assemed";
import type {
  Consultation,
  ConsultationStatus,
  Specialty,
  DecodedToken,
} from "@/integrations/assemed";
import { supabase } from "@/integrations/supabase/client";

// ==========================================
// TIPOS DO SERVIÇO
// ==========================================

export interface TelemedicinePatient {
  id: string; // ID do Supabase
  assemedPacienteId?: number;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  dataNascimento: string;
  sexo: "M" | "F";
}

export interface SubscriptionStatus {
  isActive: boolean;
  planType: string | null;
  expiresAt: string | null;
  consultationsRemaining: number | null;
}

export interface StartConsultationResult {
  success: boolean;
  consultationId?: number;
  waitingRoomUrl?: string;
  pacienteToken?: string;
  error?: string;
}

// ==========================================
// VERIFICAÇÃO DE ADIMPLÊNCIA
// ==========================================

/**
 * Verifica se o usuário está adimplente (tem assinatura ativa e dentro da validade)
 */
export async function checkSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatus> {
  try {
    const { data: subscription, error } = await supabase
      .from("user_subscriptions")
      .select(`
        *,
        subscription_plans (
          name,
          type,
          specialist_consultations_per_year
        )
      `)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error || !subscription) {
      console.log("[Telemedicine] Nenhuma assinatura encontrada para o usuário:", userId);
      return {
        isActive: false,
        planType: null,
        expiresAt: null,
        consultationsRemaining: null,
      };
    }

    // Verifica se a assinatura está dentro do período de vigência
    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
    
    // Considera inadimplente se:
    // 1. Não tem data de expiração (inconsistência)
    // 2. Data de expiração já passou
    const isExpired = !expiresAt || expiresAt <= now;
    const isWithinPeriod = !isExpired;

    // Acessa os dados do plano de forma segura
    const planData = subscription.subscription_plans as { 
      name: string; 
      type: string; 
      specialist_consultations_per_year: number | null 
    } | null;

    console.log("[Telemedicine] Status da assinatura:", {
      userId,
      status: subscription.status,
      expires_at: subscription.expires_at,
      isExpired,
      isWithinPeriod,
      planType: planData?.type,
      now: now.toISOString(),
    });

    // Retorna status de adimplência
    return {
      isActive: isWithinPeriod && subscription.status === "active",
      planType: planData?.type || null,
      expiresAt: subscription.expires_at,
      consultationsRemaining: planData?.specialist_consultations_per_year || null,
    };
  } catch (error) {
    console.error("[Telemedicine] Erro ao verificar assinatura:", error);
    return {
      isActive: false,
      planType: null,
      expiresAt: null,
      consultationsRemaining: null,
    };
  }
}

/**
 * Verifica se o usuário pode acessar a telemedicina
 * Retorna objeto com status detalhado para feedback ao usuário
 */
export async function canAccessTelemedicine(userId: string): Promise<{
  canAccess: boolean;
  reason?: "no_subscription" | "expired" | "inactive";
  message?: string;
  subscription?: SubscriptionStatus;
}> {
  const subscription = await checkSubscriptionStatus(userId);

  if (!subscription.planType) {
    return {
      canAccess: false,
      reason: "no_subscription",
      message: "Você não possui uma assinatura ativa. Por favor, assine um plano para acessar a telemedicina.",
      subscription,
    };
  }

  if (!subscription.isActive) {
    // Verifica se expirou ou está inativa
    const now = new Date();
    const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
    const isExpired = expiresAt && expiresAt <= now;

    return {
      canAccess: false,
      reason: isExpired ? "expired" : "inactive",
      message: isExpired
        ? "Sua assinatura expirou. Por favor, regularize seu pagamento para continuar acessando a telemedicina."
        : "Sua assinatura não está ativa. Entre em contato com o suporte para mais informações.",
      subscription,
    };
  }

  return {
    canAccess: true,
    subscription,
  };
}

// ==========================================
// GESTÃO DE PACIENTE NA ASSEMED
// ==========================================

/**
 * Obtém ou cria o paciente na plataforma Assemed
 */
export async function ensurePatientRegistered(
  patient: TelemedicinePatient
): Promise<number> {
  // Primeiro tenta fazer login para ver se paciente já existe
  try {
    const loginResponse = await assemedClient.login(patient.cpf);
    const decoded = assemedClient.decodeToken(loginResponse.accessToken);

    if (decoded?.pacienteId) {
      return parseInt(decoded.pacienteId, 10);
    }
  } catch {
    // Paciente não existe, vamos cadastrar
  }

  // Cadastra o paciente
  const registerResponse = await assemedClient.registerPatient({
    nome: patient.nome,
    cpf: patient.cpf,
    email: patient.email,
    telefone: patient.telefone,
    dataNascimento: patient.dataNascimento,
    sexo: patient.sexo,
  });

  // Faz login para obter o token
  await assemedClient.login(patient.cpf);

  return registerResponse.pacienteId;
}

/**
 * Autentica o paciente e obtém o token de acesso
 */
export async function authenticatePatient(cpf: string): Promise<DecodedToken | null> {
  try {
    const response = await assemedClient.login(cpf);
    return assemedClient.decodeToken(response.accessToken);
  } catch (error) {
    console.error("[Telemedicine] Erro ao autenticar paciente:", error);
    return null;
  }
}

// ==========================================
// ESPECIALIDADES
// ==========================================

/**
 * Obtém lista de especialidades disponíveis
 */
export async function getSpecialties(): Promise<Specialty[]> {
  try {
    const response = await assemedClient.getSpecialties();
    return response.items;
  } catch (error) {
    console.error("[Telemedicine] Erro ao obter especialidades:", error);
    return [];
  }
}

// ==========================================
// CONSULTAS
// ==========================================

/**
 * Inicia uma nova consulta de telemedicina
 */
export async function startConsultation(
  patient: TelemedicinePatient,
  especialidadeId: number,
  tipoProfissionalId: number
): Promise<StartConsultationResult> {
  try {
    // Verifica adimplência
    const subscription = await checkSubscriptionStatus(patient.id);
    if (!subscription.isActive) {
      return {
        success: false,
        error: "Sua assinatura não está ativa. Por favor, regularize seu pagamento para acessar a telemedicina.",
      };
    }

    // Garante que o paciente está cadastrado na Assemed
    const pacienteId = await ensurePatientRegistered(patient);

    // Cria a consulta
    const response = await assemedClient.createConsultation({
      pacienteId,
      especialidadeId,
      tipoProfissional: tipoProfissionalId,
    });

    // Monta a URL da sala de espera
    const credentials = getAssemedCredentials();
    const waitingRoomUrl = getWaitingRoomUrl(
      response.id,
      response.pacienteToken,
      credentials.isSandbox
    );

    return {
      success: true,
      consultationId: response.id,
      waitingRoomUrl,
      pacienteToken: response.pacienteToken,
    };
  } catch (error) {
    console.error("[Telemedicine] Erro ao iniciar consulta:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao iniciar consulta",
    };
  }
}

/**
 * Obtém histórico de consultas do paciente
 */
export async function getConsultationHistory(): Promise<Consultation[]> {
  try {
    const response = await assemedClient.getConsultations();
    return response.items;
  } catch (error) {
    console.error("[Telemedicine] Erro ao obter histórico:", error);
    return [];
  }
}

/**
 * Obtém detalhes de uma consulta específica
 */
export async function getConsultationDetails(
  consultationId: number
): Promise<Consultation | null> {
  return assemedClient.getConsultation(consultationId);
}

/**
 * Verifica o status de uma consulta (para polling)
 */
export async function pollConsultationStatus(
  consultationId: number
): Promise<ConsultationStatus> {
  try {
    const status = await assemedClient.getConsultationStatus(consultationId);
    return status.situacao;
  } catch {
    return "CANCELADO";
  }
}

/**
 * Cancela uma consulta
 */
export async function cancelConsultation(consultationId: number): Promise<boolean> {
  try {
    await assemedClient.cancelConsultation(consultationId);
    return true;
  } catch (error) {
    console.error("[Telemedicine] Erro ao cancelar consulta:", error);
    return false;
  }
}

/**
 * Envia avaliação após a consulta
 */
export async function submitEvaluation(
  consultationId: number,
  rating: number,
  comment?: string
): Promise<boolean> {
  try {
    await assemedClient.evaluateConsultation(consultationId, rating, comment);
    return true;
  } catch (error) {
    console.error("[Telemedicine] Erro ao enviar avaliação:", error);
    return false;
  }
}

// ==========================================
// IFRAME URL
// ==========================================

/**
 * Obtém a URL do iframe de telemedicina
 */
export function getTelemedicineIframeUrl(): string {
  return TELEMEDICINA_IFRAME_URL;
}

/**
 * Monta a URL da sala de espera para uma consulta específica
 */
export function getConsultationWaitingRoomUrl(
  consultationId: number,
  pacienteToken: string
): string {
  const credentials = getAssemedCredentials();
  return getWaitingRoomUrl(consultationId, pacienteToken, credentials.isSandbox);
}
