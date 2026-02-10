// Supabase Edge Function — Cielo Webhook
// Recebe notificações de pagamento da Cielo (Notification Post)
// e atualiza orders (medicamentos) e user_subscriptions (planos/PIX).
//
// A Cielo envia apenas { PaymentId, RecurrentPaymentId?, ChangeType }.
// Esta function consulta a API Cielo para obter os detalhes completos.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ==========================================
// Tipos
// ==========================================

interface CieloNotification {
  PaymentId?: string;
  RecurrentPaymentId?: string;
  ChangeType?: number;
}

// ChangeType:
//  1 = Status do pagamento alterado
//  2 = Recorrência criada
//  3 = Status do antifraude alterado
//  4 = Status da recorrência alterado
//  6 = Boleto registrado
//  7 = Notificação de negação
//  8 = Recorrência agendada
//  9 = Cancelamento
// 10 = Chargeback

interface CieloPaymentDetail {
  Payment: {
    PaymentId: string;
    Type: string;
    Amount: number;
    Status: number;
    ReturnCode?: string;
    ReturnMessage?: string;
    RecurrentPayment?: {
      RecurrentPaymentId: string;
      NextRecurrency: string;
      Interval: string;
    };
  };
  MerchantOrderId?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ==========================================
// Handler principal
// ==========================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // Validação de segurança (header customizado registrado na Cielo)
    const webhookSecret = Deno.env.get("CIELO_WEBHOOK_SECRET");
    if (webhookSecret) {
      const reqSecret = req.headers.get("x-webhook-secret");
      if (reqSecret !== webhookSecret) {
        console.warn("Webhook rejected: invalid secret");
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const notification: CieloNotification = await req.json();
    console.log("[Webhook] Recebido:", JSON.stringify(notification));

    if (!notification.PaymentId && !notification.RecurrentPaymentId) {
      return json({ error: "Missing PaymentId" }, 400);
    }

    // Consulta a API Cielo para obter detalhes completos
    const paymentDetail = notification.PaymentId
      ? await queryCieloPayment(notification.PaymentId)
      : null;

    const cieloStatus = paymentDetail?.Payment?.Status ?? -1;
    const paymentType = paymentDetail?.Payment?.Type ?? "Unknown";
    const merchantOrderId = paymentDetail?.MerchantOrderId ?? "";

    // Log do webhook (sempre persiste, mesmo se não encontrar order/subscription)
    const logEntry = {
      payment_id: notification.PaymentId ?? null,
      recurrent_payment_id:
        notification.RecurrentPaymentId ??
        paymentDetail?.Payment?.RecurrentPayment?.RecurrentPaymentId ??
        null,
      change_type: notification.ChangeType ?? null,
      cielo_status: cieloStatus,
      payment_type: paymentType,
      merchant_order_id: merchantOrderId,
      raw_notification: notification,
      raw_detail: paymentDetail,
      processed: false,
      error: null as string | null,
      processed_at: new Date().toISOString(),
    };

    // ---- Tenta atualizar ORDER (medicamentos) ----
    const orderUpdated = await tryUpdateOrder(
      supabase,
      notification,
      cieloStatus,
      merchantOrderId
    );

    // ---- Tenta atualizar SUBSCRIPTION (planos — cartão recorrente ou PIX anual) ----
    const subscriptionUpdated = await tryUpdateSubscription(
      supabase,
      notification,
      cieloStatus,
      merchantOrderId,
      paymentType
    );

    logEntry.processed = orderUpdated || subscriptionUpdated;
    if (!logEntry.processed) {
      logEntry.error = "No matching order or subscription found";
    }

    // Persiste log
    await supabase.from("cielo_webhooks").insert(logEntry).catch((err: Error) => {
      console.warn("[Webhook] Falha ao salvar log:", err.message);
    });

    // Sempre retorna 200 para a Cielo não reenviar
    return json({ received: true });
  } catch (error) {
    console.error("[Webhook] Erro:", error);
    return json({ received: true });
  }
});

// ==========================================
// Atualizar pedido de medicamento
// ==========================================

async function tryUpdateOrder(
  supabase: ReturnType<typeof createClient>,
  notification: CieloNotification,
  cieloStatus: number,
  merchantOrderId: string
): Promise<boolean> {
  // Busca por payment_id OU merchant_order_id (que pode conter o order id)
  const paymentId = notification.PaymentId;
  if (!paymentId) return false;

  const { data: order } = await supabase
    .from("orders")
    .select("id, payment_id, payment_status")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (!order) {
    // Tenta por merchant_order_id se começar com padrão de order
    if (merchantOrderId && !merchantOrderId.startsWith("SUB-")) {
      const { data: orderByMerchant } = await supabase
        .from("orders")
        .select("id, payment_id, payment_status")
        .eq("id", merchantOrderId)
        .maybeSingle();

      if (orderByMerchant) {
        return await updateOrderStatus(supabase, orderByMerchant, cieloStatus, paymentId);
      }
    }
    return false;
  }

  return await updateOrderStatus(supabase, order, cieloStatus, paymentId);
}

async function updateOrderStatus(
  supabase: ReturnType<typeof createClient>,
  order: { id: string; payment_status: string },
  cieloStatus: number,
  paymentId: string
): Promise<boolean> {
  const newStatus = mapCieloToOrderStatus(cieloStatus);
  if (newStatus === order.payment_status) return true; // Já atualizado

  await supabase
    .from("orders")
    .update({
      payment_status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  // Notifica via Realtime
  await supabase
    .channel(`order-${order.id}`)
    .send({
      type: "broadcast",
      event: "payment_status_update",
      payload: { order_id: order.id, payment_status: newStatus, payment_id: paymentId },
    })
    .catch(() => {});

  console.log(`[Webhook] Order ${order.id} atualizado: ${order.payment_status} → ${newStatus}`);
  return true;
}

// ==========================================
// Atualizar assinatura (recorrência ou PIX anual)
// ==========================================

async function tryUpdateSubscription(
  supabase: ReturnType<typeof createClient>,
  notification: CieloNotification,
  cieloStatus: number,
  merchantOrderId: string,
  paymentType: string
): Promise<boolean> {
  // Assinaturas usam MerchantOrderId com prefixo "SUB-"
  if (!merchantOrderId.startsWith("SUB-")) return false;

  const paymentId = notification.PaymentId ?? "";
  const recurrentPaymentId =
    notification.RecurrentPaymentId ?? "";

  // Busca assinatura por payment_id ou pelo merchant_order_id
  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("id, user_id, status, payment_id, billing_cycle")
    .or(`payment_id.eq.${paymentId},payment_id.eq.${recurrentPaymentId}`)
    .eq("status", "active")
    .maybeSingle();

  if (!subscription) {
    console.log(`[Webhook] Subscription not found for SUB order: ${merchantOrderId}`);
    return false;
  }

  // PIX confirmado (status 2) ou cartão recorrente confirmado
  if (cieloStatus === 2 || cieloStatus === 1) {
    console.log(
      `[Webhook] Subscription ${subscription.id} pagamento confirmado (${paymentType}, status ${cieloStatus})`
    );
    // Pagamento confirmado — manter ativa (já está)
    return true;
  }

  // Pagamento negado/cancelado — desativar assinatura
  if (cieloStatus === 3 || cieloStatus === 10 || cieloStatus === 13) {
    await supabase
      .from("user_subscriptions")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    console.log(
      `[Webhook] Subscription ${subscription.id} cancelada (status Cielo: ${cieloStatus})`
    );
    return true;
  }

  // PIX pendente (status 12) — aguardando, não faz nada
  if (cieloStatus === 12) {
    console.log(`[Webhook] Subscription ${subscription.id} PIX pendente`);
    return true;
  }

  return true;
}

// ==========================================
// Consultar API Cielo
// ==========================================

async function queryCieloPayment(
  paymentId: string
): Promise<CieloPaymentDetail | null> {
  const merchantId = Deno.env.get("CIELO_MERCHANT_ID") ?? "";
  const merchantKey = Deno.env.get("CIELO_MERCHANT_KEY") ?? "";
  const isSandbox = Deno.env.get("CIELO_SANDBOX") === "true";

  if (!merchantId || !merchantKey) {
    console.warn("[Webhook] Credenciais Cielo não configuradas, usando payload direto");
    return null;
  }

  const queryUrl = isSandbox
    ? "https://apiquerysandbox.cieloecommerce.cielo.com.br"
    : "https://apiquery.cieloecommerce.cielo.com.br";

  try {
    const response = await fetch(`${queryUrl}/1/sales/${paymentId}`, {
      headers: {
        MerchantId: merchantId,
        MerchantKey: merchantKey,
      },
    });

    if (!response.ok) {
      console.warn(`[Webhook] Cielo query failed: ${response.status}`);
      return null;
    }

    return (await response.json()) as CieloPaymentDetail;
  } catch (err) {
    console.warn("[Webhook] Erro ao consultar Cielo:", err);
    return null;
  }
}

// ==========================================
// Helpers
// ==========================================

function mapCieloToOrderStatus(status: number): string {
  const map: Record<number, string> = {
    0: "pending",      // NotFinished
    1: "processing",   // Authorized
    2: "processing",   // PaymentConfirmed
    3: "cancelled",    // Denied
    10: "cancelled",   // Voided
    11: "cancelled",   // Refunded
    12: "pending",     // Pending (PIX aguardando)
    13: "cancelled",   // Aborted
    20: "pending",     // Scheduled
  };
  return map[status] ?? "pending";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}
