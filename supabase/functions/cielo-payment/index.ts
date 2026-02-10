// Supabase Edge Function for Cielo Payment Processing
// This function handles credit card payments via Cielo API 3.0

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const CIELO_CONFIG = {
  sandbox: {
    transactionalUrl: "https://apisandbox.cieloecommerce.cielo.com.br",
    queryUrl: "https://apiquerysandbox.cieloecommerce.cielo.com.br",
  },
  production: {
    transactionalUrl: "https://api.cieloecommerce.cielo.com.br",
    queryUrl: "https://apiquery.cieloecommerce.cielo.com.br",
  },
};

interface PaymentRequest {
  orderId: string;
  customer: {
    name: string;
    email?: string;
    cpf?: string;
    birthdate?: string;
    address?: {
      street: string;
      number: string;
      complement?: string;
      district: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  card?: {
    cardNumber: string;
    holder: string;
    expirationDate: string;
    securityCode: string;
    brand: string;
  };
  amountInCents: number;
  installments: number;
  paymentType: "credit_card" | "recurrent" | "pix";
  interval?: "Monthly" | "Bimonthly" | "Quarterly" | "SemiAnnual" | "Annual";
  startDate?: string;
  endDate?: string;
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const merchantId = Deno.env.get("CIELO_MERCHANT_ID") ?? "";
    const merchantKey = Deno.env.get("CIELO_MERCHANT_KEY") ?? "";
    const isSandbox = Deno.env.get("CIELO_SANDBOX") === "true";

    if (!merchantId || !merchantKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Cielo credentials not configured" }),
        { headers }
      );
    }

    const request: PaymentRequest = await req.json();

    if (!request.orderId || !request.customer || !request.amountInCents) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers }
      );
    }

    if (request.paymentType !== "pix" && !request.card) {
      return new Response(
        JSON.stringify({ success: false, message: "Card data required for credit card payments" }),
        { status: 400, headers }
      );
    }

    if (request.paymentType === "pix" && !request.customer.cpf) {
      return new Response(
        JSON.stringify({ success: false, message: "CPF required for PIX payments" }),
        { status: 400, headers }
      );
    }

    const cieloUrls = isSandbox ? CIELO_CONFIG.sandbox : CIELO_CONFIG.production;
    const cieloRequest = buildCieloRequest(request);

    const response = await fetch(`${cieloUrls.transactionalUrl}/1/sales/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MerchantId": merchantId,
        "MerchantKey": merchantKey,
      },
      body: JSON.stringify(cieloRequest),
    });

    const cieloResponse = await response.json();

    if (!response.ok) {
      await supabase.from("payment_logs").insert({
        order_id: request.orderId,
        payment_type: request.paymentType,
        amount: request.amountInCents,
        status: "failed",
        error_message: JSON.stringify(cieloResponse),
        created_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: cieloResponse.Message ?? "Payment failed",
          errors: cieloResponse,
        }),
        { status: 400, headers }
      );
    }

    const paymentResult: Record<string, unknown> = {
      success: true,
      paymentId: cieloResponse.Payment.PaymentId,
      authorizationCode: cieloResponse.Payment.AuthorizationCode,
      status: cieloResponse.Payment.Status,
      message: cieloResponse.Payment.ReturnMessage,
      proofOfSale: cieloResponse.Payment.ProofOfSale,
      tid: cieloResponse.Payment.Tid,
      recurrentPaymentId: cieloResponse.Payment.RecurrentPayment?.RecurrentPaymentId,
    };

    // PIX-specific response fields
    if (request.paymentType === "pix") {
      paymentResult.qrCodeBase64Image = cieloResponse.Payment.QrCodeBase64Image;
      paymentResult.qrCodeString = cieloResponse.Payment.QrCodeString;
      paymentResult.expirationDate = cieloResponse.Payment.ExpirationDate;
    }

    await supabase.from("payment_logs").insert({
      order_id: request.orderId,
      payment_type: request.paymentType,
      payment_id: cieloResponse.Payment.PaymentId,
      amount: request.amountInCents,
      status: "success",
      cielo_response: cieloResponse,
      created_at: new Date().toISOString(),
    });

    // Update order: for credit card (authorized/confirmed) or PIX (pending)
    const cieloStatus = cieloResponse.Payment.Status;
    if (cieloStatus === 1 || cieloStatus === 2 || cieloStatus === 12) {
      const updateData: Record<string, unknown> = {
        payment_id: cieloResponse.Payment.PaymentId,
        payment_status: getOrderStatusFromCieloStatus(cieloStatus),
        updated_at: new Date().toISOString(),
      };

      // Store PIX data for frontend polling
      if (request.paymentType === "pix") {
        updateData.pix_qr_code = cieloResponse.Payment.QrCodeString;
        updateData.pix_expires_at = cieloResponse.Payment.ExpirationDate;
      }

      await supabase
        .from("orders")
        .update(updateData)
        .eq("id", request.orderId);
    }

    return new Response(JSON.stringify(paymentResult), { headers });
  } catch (error) {
    console.error("Payment error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers }
    );
  }
});

function buildCieloRequest(request: PaymentRequest) {
  const customer: Record<string, unknown> = {
    Name: request.customer.name,
    Email: request.customer.email,
    Identity: request.customer.cpf,
    IdentityType: request.customer.cpf ? "CPF" : undefined,
    Birthdate: request.customer.birthdate,
    Address: request.customer.address
      ? {
          Street: request.customer.address.street,
          Number: request.customer.address.number,
          Complement: request.customer.address.complement,
          District: request.customer.address.district,
          City: request.customer.address.city,
          State: request.customer.address.state,
          ZipCode: request.customer.address.zipCode.replace(/\D/g, ""),
          Country: "BRA",
        }
      : undefined,
  };

  if (request.paymentType === "pix") {
    return {
      MerchantOrderId: request.orderId,
      Customer: customer,
      Payment: {
        Type: "Pix",
        Amount: request.amountInCents,
      },
    };
  }

  const baseRequest: Record<string, unknown> = {
    MerchantOrderId: request.orderId,
    Customer: customer,
    Payment: {
      Type: "CreditCard",
      Amount: request.amountInCents,
      Installments: request.installments,
      Capture: true,
      SoftDescriptor: "NOVITA",
      CreditCard: {
        CardNumber: request.card!.cardNumber.replace(/\s/g, ""),
        Holder: request.card!.holder,
        ExpirationDate: request.card!.expirationDate,
        SecurityCode: request.card!.securityCode,
        Brand: request.card!.brand,
        SaveCard: request.paymentType === "recurrent",
      },
    },
  };

  if (request.paymentType === "recurrent") {
    (baseRequest.Payment as Record<string, unknown>).RecurrentPayment = {
      AuthorizeNow: true,
      Interval: request.interval ?? "Monthly",
      StartDate: request.startDate,
      EndDate: request.endDate,
    };
  }

  return baseRequest;
}

function getOrderStatusFromCieloStatus(status: number): string {
  const statusMap: Record<number, string> = {
    0: "pending",
    1: "processing",
    2: "processing",
    3: "cancelled",
    10: "cancelled",
    11: "cancelled",
    12: "pending",
    20: "pending",
  };
  return statusMap[status] ?? "pending";
}
