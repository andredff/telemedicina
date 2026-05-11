/**
 * Labels amigáveis em pt-BR para enums do domínio.
 *
 * Os valores técnicos (credit_card, pix, processing, ouro, ...) continuam
 * sendo a fonte de verdade no banco e nas integrações (Cielo, Supabase).
 * Use estas funções apenas no momento de EXIBIR para o usuário.
 *
 * Padrão:
 *   formatXxx(value)            -> string amigável, com fallback razoável
 *   formatXxx(value, fallback)  -> string amigável, com fallback custom
 */

type Nullable<T> = T | null | undefined;

function pickLabel<T extends string>(
  value: Nullable<string>,
  map: Record<T, string>,
  fallback?: string
): string {
  if (!value) return fallback ?? "—";
  const key = value.toLowerCase() as T;
  return map[key] ?? fallback ?? value;
}

// ── Pagamento ────────────────────────────────────────────────────────────────

const PAYMENT_METHOD: Record<string, string> = {
  credit_card: "Cartão de Crédito",
  creditcard: "Cartão de Crédito",
  credit: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  debitcard: "Cartão de Débito",
  debit: "Cartão de Débito",
  pix: "Pix",
  boleto: "Boleto Bancário",
  bank_slip: "Boleto Bancário",
};

export function formatPaymentMethod(value: Nullable<string>, fallback?: string): string {
  return pickLabel(value, PAYMENT_METHOD, fallback);
}

const PAYMENT_STATUS: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  authorized: "Pagamento autorizado",
  captured: "Pagamento capturado",
  refunded: "Estornado",
  failed: "Falhou",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  denied: "Negado",
  expired: "Expirado",
};

export function formatPaymentStatus(value: Nullable<string>, fallback?: string): string {
  return pickLabel(value, PAYMENT_STATUS, fallback);
}

// ── Pedido ───────────────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, string> = {
  pending: "Pedido Pago",
  processing: "Pedido em Separação",
  confirmed: "Pedido em Separação",
  shipped: "Pedido Enviado",
  in_transit: "Pedido Enviado",
  delivered: "Pedido Entregue",
  cancelled: "Pedido Cancelado",
  canceled: "Pedido Cancelado",
};

export function formatOrderStatus(value: Nullable<string>, fallback?: string): string {
  return pickLabel(value, ORDER_STATUS, fallback);
}

// ── Assinatura ───────────────────────────────────────────────────────────────

const SUBSCRIPTION_PLAN: Record<string, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  platina: "Platina",
  diamante: "Diamante",
  coletivo: "Coletivo",
};

export function formatSubscriptionPlan(value: Nullable<string>, fallback?: string): string {
  return pickLabel(value, SUBSCRIPTION_PLAN, fallback);
}

const SUBSCRIPTION_STATUS: Record<string, string> = {
  active: "Ativa",
  inactive: "Inativa",
  cancelled: "Cancelada",
  canceled: "Cancelada",
  pending: "Pendente",
  trial: "Período de teste",
  expired: "Expirada",
};

export function formatSubscriptionStatus(value: Nullable<string>, fallback?: string): string {
  return pickLabel(value, SUBSCRIPTION_STATUS, fallback);
}

const BILLING_CYCLE: Record<string, string> = {
  monthly: "Mensal",
  yearly: "Anual",
  annual: "Anual",
  weekly: "Semanal",
  daily: "Diária",
};

export function formatBillingCycle(value: Nullable<string>, fallback?: string): string {
  return pickLabel(value, BILLING_CYCLE, fallback);
}

// ── Receita médica (prescription) ────────────────────────────────────────────

const PRESCRIPTION_STATUS: Record<string, string> = {
  pending: "Pendente",
  partial: "Parcial",
  completed: "Completa",
  approved: "Aprovada",
  rejected: "Rejeitada",
  expired: "Expirada",
};

export function formatPrescriptionStatus(value: Nullable<string>, fallback?: string): string {
  return pickLabel(value, PRESCRIPTION_STATUS, fallback);
}

// ── OS de logística ──────────────────────────────────────────────────────────

const LOGISTICS_STATUS: Record<string, string> = {
  pending: "Pendente",
  processing: "Em separação",
  shipped: "Enviada",
  delivered: "Entregue",
  cancelled: "Cancelada",
  canceled: "Cancelada",
};

export function formatLogisticsStatus(value: Nullable<string>, fallback?: string): string {
  return pickLabel(value, LOGISTICS_STATUS, fallback);
}

// ── Revisão farmacêutica ─────────────────────────────────────────────────────

const REVIEW_STATUS: Record<string, string> = {
  approved: "Aprovada",
  rejected: "Rejeitada",
  pending: "Aguarda revisão",
};

export function formatReviewStatus(value: Nullable<string>, fallback?: string): string {
  return pickLabel(value, REVIEW_STATUS, fallback);
}
