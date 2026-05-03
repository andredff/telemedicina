/**
 * Serviço de Notificação para Logística
 * Envia notificações por e-mail quando o status do pedido é alterado
 * Usa Resend API para envio real de e-mails (via proxy Vite em dev)
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getAuthHeaders } from "@/lib/authHeaders";
import { getEmailSubject, renderEmailTemplate } from "./emailTemplates";

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export interface OrderNotification {
  orderId: string;
  customerEmail: string;
  customerName: string;
  status: OrderStatus;
  trackingCode?: string;
  estimatedDelivery?: string;
  items?: Array<{
    name: string;
    quantity: number;
  }>;
}

export interface NotificationResult {
  success: boolean;
  message: string;
  notificationId?: string;
}

interface LogisticsServiceOrder {
  orderId: string;
  createdAt: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    prescriptionId?: string;
  }>;
  priority: "normal";
  notes: string;
}

function getApiBaseUrl(): string {
  return import.meta.env.DEV
    ? ""
    : (import.meta.env.VITE_LOCAL_SERVER_URL || "");
}

/**
 * Envia notificação de alteração de status do pedido
 */
export async function sendOrderStatusNotification(
  notification: OrderNotification
): Promise<NotificationResult> {
  try {
    // ── Idempotência: ignora se o mesmo status já foi notificado nos últimos 5 min ──
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("order_notifications")
      .select("id")
      .eq("order_id", notification.orderId)
      .eq("status", notification.status)
      .gte("sent_at", fiveMinAgo)
      .limit(1);

    if (existing && existing.length > 0) {
      logger.warn(`[NOTIFICATION] Ignorada — já notificado: pedido ${notification.orderId} status ${notification.status}`);
      return { success: true, message: "Notificação já enviada recentemente (idempotência)" };
    }

    const subject = getEmailSubject(notification.status);
    const htmlBody = renderEmailTemplate(notification);

    const emailContent = {
      to: notification.customerEmail,
      subject,
      body: htmlBody,
      orderId: notification.orderId,
      status: notification.status,
      sentAt: new Date().toISOString(),
    };

    // Registra a notificação no banco de dados
    const { data, error } = await supabase
      .from("order_notifications")
      .insert({
        order_id: notification.orderId,
        customer_email: notification.customerEmail,
        customer_name: notification.customerName,
        status: notification.status,
        subject: emailContent.subject,
        body: emailContent.body,
        sent_at: emailContent.sentAt,
        tracking_code: notification.trackingCode,
        estimated_delivery: notification.estimatedDelivery,
      })
      .select()
      .single();

    if (error) {
      // Se a tabela não existir, loga mas não falha (modo graceful)
      if (error.code === "42P01") {
        logger.warn("Tabela order_notifications não existe. Notificação registrada apenas em log.");
        logger.info("Notificação de pedido:", emailContent);
        return {
          success: true,
          message: "Notificação registrada (modo fallback)",
        };
      }
      throw error;
    }

    // Envia e-mail via Resend API
    logger.info(`[NOTIFICATION] Enviando e-mail para ${notification.customerEmail}`, {
      orderId: notification.orderId,
      status: notification.status,
      subject: emailContent.subject,
    });

    await sendEmailViaResend(emailContent);

    return {
      success: true,
      message: `Notificação enviada para ${notification.customerEmail}`,
      notificationId: data?.id,
    };
  } catch (error) {
    logger.error("Erro ao enviar notificação:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Envia e-mail via Resend API (proxy /api/resend em dev, edge function em prod)
 */
async function sendEmailViaResend(emailContent: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const from =
    import.meta.env.VITE_RESEND_FROM ||
    "Novità Telemedicina <noreply@novitahomecare.com.br>";

  // Em dev: usa URL relativa → proxy Vite (/api/resend → api.resend.com) sem precisar do Express
  // Em prod: usa VITE_LOCAL_SERVER_URL → backend Express que expõe /api/resend/emails
  const baseUrl = getApiBaseUrl();

  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/resend/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        from,
        to: [emailContent.to],
        subject: emailContent.subject,
        html: emailContent.body,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error("[RESEND] Erro ao enviar e-mail:", {
        status: response.status,
        error: errorData,
      });
      throw new Error(
        `Resend API error: ${response.status} — ${errorData?.message || response.statusText}`
      );
    }

    const result = await response.json();
    logger.info("[RESEND] E-mail enviado com sucesso:", {
      id: result.id,
      to: emailContent.to,
    });
  } catch (error) {
    // Se falhar o envio real, registra mas não bloqueia o fluxo
    if (error instanceof TypeError && error.message.includes("fetch")) {
      logger.warn("[RESEND] Serviço indisponível, e-mail não enviado:", {
        to: emailContent.to,
        subject: emailContent.subject,
      });
      return;
    }
    throw error;
  }
}

/**
 * Busca histórico de notificações de um pedido
 */
export async function getOrderNotificationHistory(
  orderId: string
): Promise<Array<{
  id: string;
  status: string;
  sentAt: string;
  subject: string;
}>> {
  try {
    const { data, error } = await supabase
      .from("order_notifications")
      .select("id, status, sent_at, subject")
      .eq("order_id", orderId)
      .order("sent_at", { ascending: false });

    if (error) {
      // Se a tabela não existir, retorna array vazio
      if (error.code === "42P01") {
        return [];
      }
      throw error;
    }

    return (data || []).map((n) => ({
      id: n.id,
      status: n.status,
      sentAt: n.sent_at,
      subject: n.subject,
    }));
  } catch (error) {
    logger.error("Erro ao buscar histórico de notificações:", error);
    return [];
  }
}

/**
 * Envia notificação de ordem de serviço para logística
 */
export async function sendLogisticsServiceOrder(
  orderId: string,
  customerData: {
    name: string;
    email: string;
    phone: string;
    address: string;
  },
  items: Array<{
    name: string;
    quantity: number;
    prescriptionId?: string;
  }>
): Promise<NotificationResult> {
  try {
    const serviceOrder: LogisticsServiceOrder = {
      orderId,
      createdAt: new Date().toISOString(),
      customer: customerData,
      items,
      priority: "normal",
      notes: "Medicamentos controlados - requer assinatura na entrega",
    };

    return await notifyLogisticsTeam(serviceOrder);
  } catch (error) {
    logger.error("Erro ao criar ordem de serviço:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Cria a OS no backend e envia e-mail real para a logística.
 */
async function notifyLogisticsTeam(
  serviceOrder: LogisticsServiceOrder
): Promise<NotificationResult> {
  const baseUrl = getApiBaseUrl();

  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/logistics/service-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(serviceOrder),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result?.message || result?.error || `Falha ao notificar logística: ${response.status}`
      );
    }

    logger.info("[LOGISTICS] OS criada e notificação processada", {
      orderId: serviceOrder.orderId,
      emailSent: result.emailSent,
      notificationTo: result.notificationTo,
    });

    return {
      success: Boolean(result.emailSent),
      message: result.message || `Ordem de serviço criada para pedido #${serviceOrder.orderId}`,
    };
  } catch (error) {
    logger.error("[LOGISTICS] Falha ao notificar equipe pelo backend:", error);
    return createLogisticsServiceOrderFallback(serviceOrder, error);
  }
}

async function createLogisticsServiceOrderFallback(
  serviceOrder: LogisticsServiceOrder,
  originalError: unknown
): Promise<NotificationResult> {
  const { data: existing } = await supabase
    .from("logistics_service_orders")
    .select("id")
    .eq("order_id", serviceOrder.orderId)
    .limit(1);

  if (existing && existing.length > 0) {
    const reason = originalError instanceof Error ? originalError.message : "erro desconhecido";
    return {
      success: false,
      message: `OS já registrada, mas a notificação da logística não foi enviada: ${reason}`,
    };
  }

  const { error } = await supabase
    .from("logistics_service_orders")
    .insert({
      order_id: serviceOrder.orderId,
      customer_name: serviceOrder.customer.name,
      customer_email: serviceOrder.customer.email,
      customer_phone: serviceOrder.customer.phone,
      delivery_address: serviceOrder.customer.address,
      items: serviceOrder.items,
      status: "pending",
      created_at: serviceOrder.createdAt,
    });

  if (error && error.code !== "23505") {
    if (error.code === "42P01") {
      logger.warn("Tabela logistics_service_orders não existe. OS registrada apenas em log.");
      logger.info("Ordem de Serviço Logística:", serviceOrder);
    } else {
      throw error;
    }
  }

  const reason = originalError instanceof Error ? originalError.message : "erro desconhecido";
  return {
    success: false,
    message: `OS registrada, mas a notificação da logística não foi enviada: ${reason}`,
  };
}

export default {
  sendOrderStatusNotification,
  getOrderNotificationHistory,
  sendLogisticsServiceOrder,
};
