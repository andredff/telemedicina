// Cielo Payment Server - Local Development
// Executa junto com Supabase Local

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Client (optional - only if credentials are provided)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("✓ Supabase client initialized");
} else {
  console.log("⚠ Supabase credentials not provided - logging disabled");
}

// Cielo Configuration - API 3.0
const CIELO_CONFIG = {
  sandbox: {
    // Sandbox uses old API 1.x format
    oauthUrl: "https://authsandbox.cielo.com.br/connect/oauth2/token",
    transactionalUrl: "https://apisandbox.cieloecommerce.cielo.com.br/1/sales",
    queryUrl: "https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales",
  },
  production: {
    // Production uses old API 1.x format (OAuth not accessible)
    oauthUrl: "https://auth.cielo.com.br/connect/oauth2/token",
    transactionalUrl: "https://api.cieloecommerce.cielo.com.br/1/sales",
    queryUrl: "https://apiquery.cieloecommerce.cielo.com.br/1/sales",
  },
};

// Get OAuth2 access token
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken(credentials, cieloUrls) {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  
  try {
    const response = await fetch(cieloUrls.oauthUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: credentials.merchantId,
        client_key: credentials.merchantKey,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OAuth error:", errorText);
      throw new Error(`OAuth failed: ${errorText}`);
    }
    
    const data = await response.json();
    cachedToken = data.access_token;
    // Token expires in 3600 seconds, refresh at 3000s
    tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000;
    
    console.log("[Cielo] OAuth token obtained successfully");
    return cachedToken;
  } catch (error) {
    console.error("[Cielo] OAuth token error:", error);
    throw error;
  }
}

// Get Cielo credentials from environment
const getCieloCredentials = () => ({
  merchantId: process.env.CIELO_MERCHANT_ID || "",
  merchantKey: process.env.CIELO_MERCHANT_KEY || "",
  isSandbox: process.env.CIELO_SANDBOX === "true",
});

// Build Cielo request
function buildCieloRequest(request) {
  const baseRequest = {
    MerchantOrderId: request.orderId,
    Customer: {
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
    },
    Payment: {
      Type: "CreditCard",
      Amount: request.amountInCents,
      Installments: request.installments,
      Capture: true,
      SoftDescriptor: "NOVITA",
      CreditCard: {
        CardNumber: request.card.cardNumber.replace(/\s/g, ""),
        Holder: request.card.holder,
        ExpirationDate: request.card.expirationDate,
        SecurityCode: request.card.securityCode,
        Brand: request.card.brand,
        SaveCard: request.paymentType === "recurrent",
      },
    },
  };

  if (request.paymentType === "recurrent") {
    baseRequest.Payment.RecurrentPayment = {
      AuthorizeNow: true,
      Interval: request.interval || "Monthly",
      StartDate: request.startDate,
      EndDate: request.endDate,
    };
  }

  return baseRequest;
}

// Map Cielo status to order status
function mapCieloStatusToOrderStatus(status) {
  const statusMap = {
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
  return statusMap[status] || "pending";
}

// API: Process Payment
app.post("/api/cielo/payment", async (req, res) => {
  try {
    const credentials = getCieloCredentials();
    const { orderId, customer, card, amountInCents, installments, paymentType, interval, startDate, endDate } = req.body;

    if (!credentials.merchantId || !credentials.merchantKey) {
      return res.status(500).json({ success: false, message: "Cielo credentials not configured" });
    }

    if (!orderId || !customer || !card || !amountInCents) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const cieloUrls = credentials.isSandbox ? CIELO_CONFIG.sandbox : CIELO_CONFIG.production;
    const cieloRequest = buildCieloRequest({ orderId, customer, card, amountInCents, installments, paymentType, interval, startDate, endDate });

    console.log("Processing payment for order:", orderId);
    console.log("Cielo request:", JSON.stringify(cieloRequest, null, 2));
    
    // Using old API 1.x format (works without OAuth)
    const response = await fetch(`${cieloUrls.transactionalUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MerchantId": credentials.merchantId,
        "MerchantKey": credentials.merchantKey,
      },
      body: JSON.stringify(cieloRequest),
    });

    // Log raw response for debugging
    const responseText = await response.text();
    console.log("Cielo raw response:", responseText);

    let cieloResponse;
    try {
      cieloResponse = JSON.parse(responseText);
    } catch (e) {
      // If response is not JSON, return the raw error
      return res.status(500).json({
        success: false,
        message: "Cielo API returned invalid response",
        rawResponse: responseText.substring(0, 500),
      });
    }

    // Handle array response (Cielo can return errors as an array)
    let cieloResponseObj = cieloResponse;
    if (Array.isArray(cieloResponse)) {
      // It's an array of errors
      cieloResponseObj = { errors: cieloResponse };
    }

    // Cielo pode retornar 200 mesmo com erro (ex: credenciais inválidas)
    // A API retorna erros em diferentes formatos
    const isCieloError = 
      cieloResponse.errors || 
      cieloResponse.Message || 
      cieloResponse.returnMessage ||
      cieloResponse.ReturnMessage || // Status de erro no nível raiz
      cieloResponse.message ||
      (cieloResponse.Status && cieloResponse.Status === 3) ||
      (cieloResponse.status && cieloResponse.status === 3);
    
    // Se Status = 3 (negado), é um erro mesmo se Response = 200
    const paymentStatus = cieloResponse.Status || cieloResponse.status || cieloResponse.Payment?.Status || 3;
    if (paymentStatus === 3) {
      isCieloError = true;
    }
    
    if (!response.ok || isCieloError) {
      // Log failed payment
      if (supabase) {
        await supabase.from("payment_logs").insert({
          order_id: orderId,
          payment_type: paymentType,
          amount: amountInCents,
          status: "failed",
          error_message: JSON.stringify(cieloResponse),
          created_at: new Date().toISOString(),
        });
      }

      // Extract error message - Cielo returns errors in different formats
      let errorMsg = "Pagamento negado";
      if (cieloResponse.Message) errorMsg = cieloResponse.Message;
      else if (cieloResponse.returnMessage) errorMsg = cieloResponse.returnMessage;
      else if (cieloResponse.ReturnMessage) errorMsg = cieloResponse.ReturnMessage;
      else if (cieloResponse.message) errorMsg = cieloResponse.message;
      else if (cieloResponse.errors && cieloResponse.errors.length > 0) {
        errorMsg = cieloResponse.errors.map(e => e.Message || e.message || e).join(", ");
      }

      return res.status(400).json({
        success: false,
        message: errorMsg,
        status: paymentStatus,
        returnCode: cieloResponse.ReturnCode || cieloResponse.returnCode,
        errors: cieloResponse,
      });
    }

    // Extrair dados do pagamento (pode estar em Payment ou no nível raiz)
    const paymentData = cieloResponse.Payment || cieloResponse;
    
    const paymentResult = {
      success: true,
      paymentId: paymentData.PaymentId || paymentData.paymentId,
      authorizationCode: paymentData.AuthorizationCode || paymentData.authorizationCode,
      status: paymentData.Status || paymentData.status,
      message: paymentData.ReturnMessage || paymentData.returnMessage || "Pagamento confirmado",
      proofOfSale: paymentData.ProofOfSale || paymentData.proofOfSale,
      tid: paymentData.Tid || paymentData.tid,
      recurrentPaymentId: paymentData.RecurrentPayment?.RecurrentPaymentId,
    };

    // Log successful payment
    if (supabase) {
      await supabase.from("payment_logs").insert({
        order_id: orderId,
        payment_type: paymentType,
        payment_id: paymentResult.paymentId,
        amount: amountInCents,
        status: "success",
        cielo_response: cieloResponse,
        created_at: new Date().toISOString(),
      });

      // Update order status
      await supabase
        .from("orders")
        .update({
          payment_id: paymentResult.paymentId,
          payment_status: mapCieloStatusToOrderStatus(paymentResult.status),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
    }

    res.json(paymentResult);
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// API: Cielo Webhook (local simulation)
app.post("/api/cielo/webhook", async (req, res) => {
  try {
    const payload = req.body;
    console.log("Cielo Webhook received:", JSON.stringify(payload));

    if (!payload.PaymentId && !payload.RecurrentPaymentId) {
      return res.status(400).json({ error: "Missing payment identifiers" });
    }

    // Find order by payment_id
    let orderQuery = null;
    if (supabase && payload.PaymentId) {
      orderQuery = await supabase.from("orders").select("id, payment_id, payment_status").eq("payment_id", payload.PaymentId).single();
    }

    if (orderQuery && orderQuery.data) {
      const newStatus = mapCieloStatusToOrderStatus(payload.Status || 0);

      await supabase
        .from("orders")
        .update({
          payment_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderQuery.data.id);

      await supabase.from("cielo_webhooks").insert({
        order_id: orderQuery.data.id,
        payment_id: payload.PaymentId,
        recurrent_payment_id: payload.RecurrentPaymentId,
        old_status: orderQuery.data.payment_status,
        new_status: newStatus,
        status: payload.Status,
        raw_payload: payload,
        processed: true,
        processed_at: new Date().toISOString(),
      });
    } else {
      // Log webhook even if order not found
      if (supabase) {
        await supabase.from("cielo_webhooks").insert({
          payment_id: payload.PaymentId,
          recurrent_payment_id: payload.RecurrentPaymentId,
          status: payload.Status,
          raw_payload: payload,
          processed: false,
          processed_at: new Date().toISOString(),
          error: "Order not found",
        });
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: Get Payment Status
app.get("/api/cielo/payment/:paymentId", async (req, res) => {
  try {
    const credentials = getCieloCredentials();
    const { paymentId } = req.params;

    if (!credentials.merchantId || !credentials.merchantKey) {
      return res.status(500).json({ success: false, message: "Cielo credentials not configured" });
    }

    const cieloUrls = credentials.isSandbox ? CIELO_CONFIG.sandbox : CIELO_CONFIG.production;
    
    // Get OAuth2 token
    const accessToken = await getAccessToken(credentials, cieloUrls);

    const response = await fetch(`${cieloUrls.queryUrl}/${paymentId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "MerchantId": credentials.merchantId,
      },
    });

    const cieloResponse = await response.json();

    if (!response.ok) {
      return res.status(400).json({ success: false, message: cieloResponse.Message || "Failed to get payment" });
    }

    res.json({
      success: true,
      paymentId: cieloResponse.Payment.PaymentId,
      status: cieloResponse.Payment.Status,
      message: cieloResponse.Payment.ReturnMessage,
    });
  } catch (error) {
    console.error("Get payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Cancel Payment
app.post("/api/cielo/payment/:paymentId/cancel", async (req, res) => {
  try {
    const credentials = getCieloCredentials();
    const { paymentId } = req.params;
    const { amount } = req.body;

    if (!credentials.merchantId || !credentials.merchantKey) {
      return res.status(500).json({ success: false, message: "Cielo credentials not configured" });
    }

    const cieloUrls = credentials.isSandbox ? CIELO_CONFIG.sandbox : CIELO_CONFIG.production;
    
    // Get OAuth2 token
    const accessToken = await getAccessToken(credentials, cieloUrls);

    const url = amount
      ? `${cieloUrls.queryUrl}/${paymentId}/void?amount=${amount}`
      : `${cieloUrls.queryUrl}/${paymentId}/void`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "MerchantId": credentials.merchantId,
      },
    });

    const cieloResponse = await response.json();

    if (!response.ok) {
      return res.status(400).json({ success: false, message: cieloResponse.Message || "Failed to cancel payment" });
    }

    res.json({
      success: true,
      paymentId: cieloResponse.Payment.PaymentId,
      status: cieloResponse.Payment.Status,
      message: cieloResponse.Payment.ReturnMessage,
    });
  } catch (error) {
    console.error("Cancel payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    server: "cielo-server",
    version: "1.0.0",
    supabase: process.env.SUPABASE_URL || "not configured",
    cielo: {
      merchantId: getCieloCredentials().merchantId ? "configured" : "not configured",
      sandbox: getCieloCredentials().isSandbox,
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   Cielo Payment Server - Local Development            ║
║                                                       ║
║   Server running on: http://localhost:${PORT}              ║
║                                                       ║
║   Endpoints:                                         ║
║   POST   /api/cielo/payment       - Process payment  ║
║   POST   /api/cielo/webhook       - Webhook receiver ║
║   GET    /api/cielo/payment/:id   - Get payment      ║
║   POST   /api/cielo/payment/:id/cancel - Cancel       ║
║   GET    /api/health              - Health check     ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  process.exit(0);
});
