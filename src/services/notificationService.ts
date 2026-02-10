/**
 * Serviço de Notificação para Logística
 * Envia notificações por e-mail quando o status do pedido é alterado
 * Usa Resend API para envio real de e-mails (via proxy Vite em dev)
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
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

/**
 * Envia notificação de alteração de status do pedido
 */
export async function sendOrderStatusNotification(
  notification: OrderNotification
): Promise<NotificationResult> {
  try {
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
    "Novità Telemedicina <onboarding@resend.dev>";

  const useLocalServer = import.meta.env.VITE_USE_LOCAL_SERVER === "true";
  const localServerUrl =
    import.meta.env.VITE_LOCAL_SERVER_URL ||
    (import.meta.env.DEV ? "http://localhost:5174" : "");
  const baseUrl = useLocalServer ? localServerUrl : "";

  try {
    const response = await fetch(`${baseUrl}/api/resend/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const serviceOrder = {
      orderId,
      createdAt: new Date().toISOString(),
      customer: customerData,
      items,
      priority: "normal",
      notes: "Medicamentos controlados - requer assinatura na entrega",
    };

    // Registra a ordem de serviço
    const { error } = await supabase
      .from("logistics_service_orders")
      .insert({
        order_id: orderId,
        customer_name: customerData.name,
        customer_email: customerData.email,
        customer_phone: customerData.phone,
        delivery_address: customerData.address,
        items: items,
        status: "pending",
        created_at: serviceOrder.createdAt,
      });

    if (error) {
      // Se a tabela não existir, loga mas não falha
      if (error.code === "42P01") {
        logger.warn("Tabela logistics_service_orders não existe. OS registrada apenas em log.");
        logger.info("Ordem de Serviço Logística:", serviceOrder);
        return {
          success: true,
          message: "Ordem de serviço registrada (modo fallback)",
        };
      }
      throw error;
    }

    logger.info(`[LOGISTICS] Ordem de serviço criada para pedido #${orderId}`);

    // Envia notificação para equipe de logística (simulado)
    await notifyLogisticsTeam(serviceOrder);

    return {
      success: true,
      message: `Ordem de serviço criada para pedido #${orderId}`,
    };
  } catch (error) {
    logger.error("Erro ao criar ordem de serviço:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Notifica equipe de logística (simulado)
 */
async function notifyLogisticsTeam(serviceOrder: {
  orderId: string;
  customer: { name: string; address: string };
  items: Array<{ name: string; quantity: number }>;
}): Promise<void> {
  // Em produção, enviaria para sistema de logística ou equipe via e-mail/webhook
  logger.info(`[LOGISTICS TEAM] Nova ordem de serviço:`, {
    orderId: serviceOrder.orderId,
    customer: serviceOrder.customer.name,
    itemCount: serviceOrder.items.length,
  });
}

export default {
  sendOrderStatusNotification,
  getOrderNotificationHistory,
  sendLogisticsServiceOrder,
};
