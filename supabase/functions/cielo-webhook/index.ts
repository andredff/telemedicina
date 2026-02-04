// Supabase Edge Function for Cielo Webhook
// Recebe notificações de pagamento da Cielo e atualiza o banco

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface CieloWebhookPayload {
  PaymentId?: string;
  RecurrentPaymentId?: string;
  OrderId?: string;
  Status?: number;
  ReturnCode?: string;
  ReturnMessage?: string;
  Amount?: number;
  Type?: string;
}

serve(async (req: Request) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: CieloWebhookPayload = await req.json();

    console.log("Cielo Webhook received:", JSON.stringify(payload));

    if (!payload.PaymentId && !payload.RecurrentPaymentId) {
      return new Response(JSON.stringify({ error: "Missing payment identifiers" }), {
        status: 400,
        headers,
      });
    }

    // Find the order by payment_id
    let orderQuery = supabase
      .from("orders")
      .select("id, payment_id, payment_status")
      .eq("payment_id", payload.PaymentId ?? "")
      .single();

    if (payload.RecurrentPaymentId && !payload.PaymentId) {
      orderQuery = supabase
        .from("orders")
        .select("id, payment_id, payment_status")
        .ilike("payment_id", `%${payload.RecurrentPaymentId}%`)
        .single();
    }

    const { data: order, error: orderError } = await orderQuery;

    if (orderError || !order) {
      console.log("Order not found for payment:", payload.PaymentId ?? payload.RecurrentPaymentId);
      await supabase.from("cielo_webhooks").insert({
        payment_id: payload.PaymentId,
        recurrent_payment_id: payload.RecurrentPaymentId,
        status: payload.Status,
        raw_payload: payload,
        processed: false,
        processed_at: new Date().toISOString(),
        error: "Order not found",
      });
      return new Response(JSON.stringify({ received: true }), { headers });
    }

    const newStatus = mapCieloStatusToOrderStatus(payload.Status ?? 0);
    
    await supabase
      .from("orders")
      .update({
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    await supabase.from("cielo_webhooks").insert({
      order_id: order.id,
      payment_id: payload.PaymentId,
      recurrent_payment_id: payload.RecurrentPaymentId,
      old_status: order.payment_status,
      new_status: newStatus,
      status: payload.Status,
      return_code: payload.ReturnCode,
      return_message: payload.ReturnMessage,
      raw_payload: payload,
      processed: true,
      processed_at: new Date().toISOString(),
    });

    if (order.id) {
      await supabase.channel(`order-${order.id}`).send({
        type: "broadcast",
        event: "payment_status_update",
        payload: {
          order_id: order.id,
          payment_status: newStatus,
          payment_id: payload.PaymentId,
          status: payload.Status,
        },
      });
    }

    return new Response(JSON.stringify({ received: true }), { headers });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers }
    );
  }
});

function mapCieloStatusToOrderStatus(status: number): string {
  const statusMap: Record<number, string> = {
    0: "pending",
    1: "processing",
    2: "processing",
    3: "cancelled",
    10: "cancelled",
    11: "cancelled",
    12: "pending",
    13: "cancelled",
    20: "pending",
  };
  return statusMap[status] ?? "pending";
}
