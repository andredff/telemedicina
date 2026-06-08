import { supabase } from "@/integrations/supabase/client";

// ==========================================
// TIPOS DO SERVIÇO
// ==========================================

export interface SubscriptionStatus {
  isActive: boolean;
  planType: string | null;
  expiresAt: string | null;
  consultationsRemaining: number | null;
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

    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
    const isExpired = !expiresAt || expiresAt <= now;
    const isWithinPeriod = !isExpired;

    const planData = subscription.subscription_plans as {
      name: string;
      type: string;
      specialist_consultations_per_year: number | null;
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

