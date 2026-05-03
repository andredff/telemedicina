/**
 * Serviço de Métricas Financeiras
 * Calcula MRR, Churn, Inadimplência e outras métricas do Dashboard
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface FinancialMetrics {
  // Métricas de Assinantes
  totalSubscribers: number;
  activeSubscribers: number;
  inactiveSubscribers: number;

  // Métricas Financeiras
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  subscriptionRevenue: number;
  oneOffRevenue: number;
  totalRevenue: number;
  averageTicket: number;
  averageOrderTicket: number;
  oneOffOrders: number;

  // Inadimplência
  delinquentSubscribers: number;
  delinquencyRate: number; // Percentual de inadimplência
  delinquentAmount: number; // Valor total em atraso

  // Churn
  churnRate: number; // Taxa de cancelamento (%)
  cancelledThisMonth: number;
  newSubscribersThisMonth: number;
  netGrowth: number;

  // Distribuição por Plano
  planDistribution: {
    bronze: number;
    prata: number;
    ouro: number;
    diamante: number;
    coletivo: number;
  };

  // Tendência
  mrrGrowth: number; // Crescimento MRR mês a mês (%)
  subscriberGrowth: number; // Crescimento de assinantes (%)
}

export interface MonthlyMetrics {
  month: string;
  mrr: number;
  oneOffRevenue: number;
  totalRevenue: number;
  orders: number;
  subscribers: number;
  churn: number;
  newSubscribers: number;
}

// Valores dos planos (em R$)
const PLAN_PRICES: Record<string, number> = {
  bronze: 79.90,
  prata: 149.90,
  ouro: 249.90,
  diamante: 449.90,
  coletivo: 39.90, // por pessoa
};

type NormalizedPlanKey = "bronze" | "prata" | "ouro" | "diamante" | "coletivo";
type PlanData = { type?: string | null; price_monthly?: number | null; price?: number | null };
type SubscriptionWithPlan = {
  plan?: PlanData | PlanData[] | null;
  subscription_plans?: PlanData | PlanData[] | null;
};

const PAID_ORDER_STATUSES = new Set(["processing", "shipped", "delivered"]);

const normalizePlanType = (type: string | null | undefined): NormalizedPlanKey | null => {
  if (!type) return null;
  if (type.includes("coletivo")) return "coletivo";
  if (type === "diamante" || type === "platina") return "diamante";
  if (type === "bronze" || type === "prata" || type === "ouro") return type;
  return null;
};

const resolvePlanPrice = (planType: string | null | undefined, planPrice?: number | null) => {
  if (typeof planPrice === "number") return planPrice;
  if (!planType) return 0;
  return PLAN_PRICES[planType] || 0;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const getPlanData = (subscription: SubscriptionWithPlan): PlanData | undefined => {
  const plan = subscription.plan ?? subscription.subscription_plans;
  return Array.isArray(plan) ? plan[0] : plan || undefined;
};

const calculateSubscriptionRevenue = (subscriptions: SubscriptionWithPlan[]) => roundCurrency(
  subscriptions.reduce((sum, subscription) => {
    const planData = getPlanData(subscription);
    const normalized = normalizePlanType(planData?.type);
    const planKey = normalized || "coletivo";
    return sum + resolvePlanPrice(planKey, planData?.price_monthly ?? planData?.price);
  }, 0)
);

/**
 * Busca métricas financeiras completas do dashboard
 */
export async function getFinancialMetrics(): Promise<FinancialMetrics> {
  try {
    const [subscriptionData, delinquencyData, churnData, orderRevenueData] = await Promise.all([
      fetchSubscriptionData(),
      fetchDelinquencyData(),
      fetchChurnData(),
      fetchOrderRevenueData(),
    ]);

    // Calcula MRR
    const mrr = subscriptionData.activeRevenue;
    const oneOffRevenue = orderRevenueData.currentMonthRevenue;
    const totalRevenue = roundCurrency(mrr + oneOffRevenue);
    const paidUnits = subscriptionData.active + orderRevenueData.currentMonthOrders;

    // Monta objeto de métricas
    const metrics: FinancialMetrics = {
      // Assinantes
      totalSubscribers: subscriptionData.total,
      activeSubscribers: subscriptionData.active,
      inactiveSubscribers: subscriptionData.inactive,

      // Financeiro
      mrr,
      arr: mrr * 12,
      subscriptionRevenue: mrr,
      oneOffRevenue,
      totalRevenue,
      averageTicket: paidUnits > 0 ? roundCurrency(totalRevenue / paidUnits) : 0,
      averageOrderTicket: orderRevenueData.averageOrderTicket,
      oneOffOrders: orderRevenueData.currentMonthOrders,

      // Inadimplência
      delinquentSubscribers: delinquencyData.count,
      delinquencyRate: subscriptionData.total > 0
        ? (delinquencyData.count / subscriptionData.total) * 100
        : 0,
      delinquentAmount: delinquencyData.totalAmount,

      // Churn
      churnRate: churnData.rate,
      cancelledThisMonth: churnData.cancelledThisMonth,
      newSubscribersThisMonth: churnData.newThisMonth,
      netGrowth: churnData.newThisMonth - churnData.cancelledThisMonth,

      // Distribuição
      planDistribution: subscriptionData.activeByPlan,

      // Tendência
      mrrGrowth: churnData.mrrGrowth,
      subscriberGrowth: churnData.subscriberGrowth,
    };

    return metrics;
  } catch (error) {
    logger.error("Erro ao buscar métricas financeiras:", error);
    // Retorna métricas zeradas em caso de erro
    return getEmptyMetrics();
  }
}

/**
 * Busca dados de assinaturas
 */
async function fetchSubscriptionData(): Promise<{
  total: number;
  active: number;
  inactive: number;
  activeByPlan: {
    bronze: number;
    prata: number;
    ouro: number;
    diamante: number;
    coletivo: number;
  };
  activeRevenue: number;
}> {
  try {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select(`
        id,
        status,
        created_at,
        expires_at,
        plan:subscription_plans (
          type,
          price_monthly
        )
      `);

    if (error) {
      // Se tabela não existir, retorna dados mock
      if (error.code === "42P01") {
        return getMockSubscriptionData();
      }
      throw error;
    }

    const subscriptions = (data || []) as Array<{
      status: string;
      created_at: string;
      expires_at?: string | null;
      plan?: { type?: string | null; price_monthly?: number | null } | Array<{ type?: string | null; price_monthly?: number | null }>;
    }>;
    const now = new Date();
    const active = subscriptions.filter((s) => {
      const expiresAt = s.expires_at ? new Date(s.expires_at) : null;
      const isExpired = !!expiresAt && expiresAt <= now;
      return s.status === "active" && !isExpired;
    });

    // Conta por plano
    const activeByPlan = {
      bronze: 0,
      prata: 0,
      ouro: 0,
      diamante: 0,
      coletivo: 0,
    };

    let activeRevenue = 0;
    active.forEach((subscription) => {
      const planData = Array.isArray(subscription.plan)
        ? subscription.plan[0]
        : subscription.plan;
      const normalized = normalizePlanType(planData?.type);
      const planKey = normalized || "coletivo";
      const price = resolvePlanPrice(planKey, planData?.price_monthly);
      activeRevenue += price;

      if (normalized) {
        activeByPlan[normalized] += 1;
      }
    });

    return {
      total: subscriptions.length,
      active: active.length,
      inactive: subscriptions.length - active.length,
      activeByPlan,
      activeRevenue: Math.round(activeRevenue * 100) / 100,
    };
  } catch (error) {
    logger.warn("Usando dados mock para assinaturas:", error);
    return getMockSubscriptionData();
  }
}

/**
 * Busca dados de inadimplência
 */
async function fetchDelinquencyData(): Promise<{
  count: number;
  totalAmount: number;
}> {
  try {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select(`
        id,
        status,
        expires_at,
        plan:subscription_plans (
          type,
          price_monthly
        )
      `);

    if (error) {
      if (error.code === "42P01") {
        return getMockDelinquencyData();
      }
      throw error;
    }

    const now = new Date();
    const delinquent = ((data || []) as Array<{
      status: string;
      expires_at?: string | null;
      plan?: { type?: string | null; price_monthly?: number | null } | Array<{ type?: string | null; price_monthly?: number | null }>;
    }>).filter((subscription) => {
      const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
      const isExpired = !!expiresAt && expiresAt <= now;
      return subscription.status !== "active" || isExpired;
    });

    const totalAmount = delinquent.reduce((sum, subscription) => {
      const planData = Array.isArray(subscription.plan)
        ? subscription.plan[0]
        : subscription.plan;
      const normalized = normalizePlanType(planData?.type);
      const planKey = normalized || "coletivo";
      const price = resolvePlanPrice(planKey, planData?.price_monthly);
      return sum + price;
    }, 0);

    return {
      count: delinquent.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  } catch (error) {
    logger.warn("Usando dados mock para inadimplência:", error);
    return getMockDelinquencyData();
  }
}

/**
 * Busca dados de churn
 */
async function fetchChurnData(): Promise<{
  rate: number;
  cancelledThisMonth: number;
  newThisMonth: number;
  mrrGrowth: number;
  subscriberGrowth: number;
}> {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Busca cancelamentos do mês
    const { data: cancelled, error: cancelledError } = await supabase
      .from("user_subscriptions")
      .select("id")
      .eq("status", "cancelled")
      .gte("cancelled_at", firstDayOfMonth.toISOString());

    if (cancelledError && cancelledError.code !== "42P01") {
      throw cancelledError;
    }

    // Busca novos assinantes do mês
    const { data: newSubs, error: newError } = await supabase
      .from("user_subscriptions")
      .select("id")
      .gte("created_at", firstDayOfMonth.toISOString());

    if (newError && newError.code !== "42P01") {
      throw newError;
    }

    // Busca total de assinantes no início do mês
    const { data: startOfMonth, error: startError } = await supabase
      .from("user_subscriptions")
      .select("id")
      .eq("status", "active")
      .lt("created_at", firstDayOfMonth.toISOString());

    if (startError && startError.code !== "42P01") {
      throw startError;
    }

    const cancelledCount = cancelled?.length || 0;
    const newCount = newSubs?.length || 0;
    const startCount = startOfMonth?.length || 1; // Evita divisão por zero

    // Calcula taxa de churn: (cancelados / total início do mês) * 100
    const churnRate = (cancelledCount / startCount) * 100;

    // Crescimento de assinantes
    const subscriberGrowth = ((newCount - cancelledCount) / startCount) * 100;

    // MRR growth (simplificado - em produção seria mais complexo)
    const mrrGrowth = subscriberGrowth; // Aproximação

    return {
      rate: Math.round(churnRate * 100) / 100,
      cancelledThisMonth: cancelledCount,
      newThisMonth: newCount,
      mrrGrowth: Math.round(mrrGrowth * 100) / 100,
      subscriberGrowth: Math.round(subscriberGrowth * 100) / 100,
    };
  } catch (error) {
    logger.warn("Usando dados mock para churn:", error);
    return getMockChurnData();
  }
}

async function fetchOrderRevenueData(): Promise<{
  currentMonthRevenue: number;
  currentMonthOrders: number;
  totalRevenue: number;
  totalOrders: number;
  averageOrderTicket: number;
}> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const { data, error } = await supabase
      .from("orders")
      .select("id, total, subtotal, shipping_cost, status, date, created_at");

    if (error) {
      if (error.code === "42P01") {
        return getMockOrderRevenueData();
      }
      throw error;
    }

    const revenueOrders = ((data || []) as Array<{
      total?: number | string | null;
      subtotal?: number | string | null;
      shipping_cost?: number | string | null;
      status?: string | null;
      date?: string | null;
      created_at?: string | null;
    }>).filter((order) => PAID_ORDER_STATUSES.has(order.status || ""));

    const orderTotal = (order: {
      total?: number | string | null;
      subtotal?: number | string | null;
      shipping_cost?: number | string | null;
    }) => {
      const total = Number(order.total);
      if (Number.isFinite(total)) return total;
      const subtotal = Number(order.subtotal) || 0;
      const shipping = Number(order.shipping_cost) || 0;
      return subtotal + shipping;
    };

    const currentMonthOrders = revenueOrders.filter((order) => {
      const orderDate = order.date || order.created_at;
      if (!orderDate) return false;
      const date = new Date(orderDate);
      return date >= monthStart && date < nextMonth;
    });

    const totalRevenue = revenueOrders.reduce((sum, order) => sum + orderTotal(order), 0);
    const currentMonthRevenue = currentMonthOrders.reduce((sum, order) => sum + orderTotal(order), 0);

    return {
      currentMonthRevenue: roundCurrency(currentMonthRevenue),
      currentMonthOrders: currentMonthOrders.length,
      totalRevenue: roundCurrency(totalRevenue),
      totalOrders: revenueOrders.length,
      averageOrderTicket: revenueOrders.length > 0 ? roundCurrency(totalRevenue / revenueOrders.length) : 0,
    };
  } catch (error) {
    logger.warn("Usando dados mock para pedidos avulsos:", error);
    return getMockOrderRevenueData();
  }
}

/**
 * Calcula MRR baseado nos assinantes ativos por plano
 */
function calculateMRR(activeByPlan: Record<string, number>): number {
  let mrr = 0;

  for (const [plan, count] of Object.entries(activeByPlan)) {
    const price = PLAN_PRICES[plan] || 0;
    mrr += price * count;
  }

  return Math.round(mrr * 100) / 100;
}

/**
 * Busca histórico mensal de métricas
 */
export async function getMonthlyMetricsHistory(months: number = 6): Promise<MonthlyMetrics[]> {
  try {
    const history: MonthlyMetrics[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthName = date.toLocaleDateString("pt-BR", { month: "short" });
      
      const monthStart = date.toISOString();
      const monthEnd = nextMonth.toISOString();

      const [
        newSubscribersResult,
        cancelledResult,
        totalSubscribersResult,
        activeSubscriptionsResult,
        ordersResult,
      ] = await Promise.all([
        supabase
          .from("user_subscriptions")
          .select("*", { count: "exact", head: true })
          .gte("created_at", monthStart)
          .lt("created_at", monthEnd),
        supabase
          .from("user_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("status", "cancelled")
          .gte("updated_at", monthStart)
          .lt("updated_at", monthEnd),
        supabase
          .from("user_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
          .lt("created_at", monthEnd),
        supabase
          .from("user_subscriptions")
          .select("plan:subscription_plans(type, price_monthly)")
          .eq("status", "active")
          .lt("created_at", monthEnd),
        supabase
          .from("orders")
          .select("total, subtotal, shipping_cost, status, date, created_at")
          .gte("date", monthStart)
          .lt("date", monthEnd),
      ]);

      const newSubscribers = newSubscribersResult.count || 0;
      const cancelledCount = cancelledResult.count || 0;
      const totalSubscribers = totalSubscribersResult.count || 0;

      // Calcula churn rate
      const activeAtStart = totalSubscribers + cancelledCount - newSubscribers;
      const churnRate = activeAtStart > 0 ? (cancelledCount / activeAtStart) * 100 : 0;

      const mrr = calculateSubscriptionRevenue(
        (activeSubscriptionsResult.data || []) as SubscriptionWithPlan[]
      );
      const orderRows = (ordersResult.data || []) as Array<{
        total?: number | string | null;
        subtotal?: number | string | null;
        shipping_cost?: number | string | null;
        status?: string | null;
      }>;
      const revenueOrders = orderRows.filter((order) => PAID_ORDER_STATUSES.has(order.status || ""));
      const oneOffRevenue = roundCurrency(revenueOrders.reduce((sum, order) => {
        const total = Number(order.total);
        if (Number.isFinite(total)) return sum + total;
        return sum + (Number(order.subtotal) || 0) + (Number(order.shipping_cost) || 0);
      }, 0));

      history.push({
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        mrr,
        oneOffRevenue,
        totalRevenue: roundCurrency(mrr + oneOffRevenue),
        orders: revenueOrders.length,
        subscribers: totalSubscribers,
        churn: Math.round(churnRate * 10) / 10,
        newSubscribers,
      });
    }

    return history;
  } catch (error) {
    logger.error("Erro ao buscar histórico de métricas:", error);
    return [];
  }
}

// =====================
// Mock Data Functions
// =====================

function getMockSubscriptionData() {
  return {
    total: 487,
    active: 423,
    inactive: 64,
    activeByPlan: {
      bronze: 120,
      prata: 156,
      ouro: 89,
      diamante: 42,
      coletivo: 16,
    },
    activeRevenue: calculateMRR({
      bronze: 120,
      prata: 156,
      ouro: 89,
      diamante: 42,
      coletivo: 16,
    }),
  };
}

function getMockDelinquencyData() {
  return {
    count: 38,
    totalAmount: 5847.60,
  };
}

function getMockChurnData() {
  return {
    rate: 3.2,
    cancelledThisMonth: 14,
    newThisMonth: 47,
    mrrGrowth: 8.5,
    subscriberGrowth: 7.8,
  };
}

function getMockOrderRevenueData() {
  return {
    currentMonthRevenue: 18472.35,
    currentMonthOrders: 96,
    totalRevenue: 148920.50,
    totalOrders: 812,
    averageOrderTicket: 183.40,
  };
}

function getEmptyMetrics(): FinancialMetrics {
  return {
    totalSubscribers: 0,
    activeSubscribers: 0,
    inactiveSubscribers: 0,
    mrr: 0,
    arr: 0,
    subscriptionRevenue: 0,
    oneOffRevenue: 0,
    totalRevenue: 0,
    averageTicket: 0,
    averageOrderTicket: 0,
    oneOffOrders: 0,
    delinquentSubscribers: 0,
    delinquencyRate: 0,
    delinquentAmount: 0,
    churnRate: 0,
    cancelledThisMonth: 0,
    newSubscribersThisMonth: 0,
    netGrowth: 0,
    planDistribution: {
      bronze: 0,
      prata: 0,
      ouro: 0,
      diamante: 0,
      coletivo: 0,
    },
    mrrGrowth: 0,
    subscriberGrowth: 0,
  };
}

export default {
  getFinancialMetrics,
  getMonthlyMetricsHistory,
};
