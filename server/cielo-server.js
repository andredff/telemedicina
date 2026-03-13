// Cielo Payment Server - Local Development
// Executa junto com Supabase Local

const path = require("path");
const dotenv = require("dotenv");
// Load developer secrets from `.env.local` first (gitignored), then defaults from `.env`.
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: false });
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5174;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Client (optional - only if credentials are provided)
// Falls back to VITE_ prefixed URLs for convenience when sharing .env.local with the frontend.
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
if (supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("✓ Supabase client initialized");
} else {
  console.log("⚠ Supabase credentials not provided - logging disabled");
}

// Cielo Configuration - API 3.0
const CIELO_CONFIG = {
  sandbox: {
    transactionalUrl: "https://apisandbox.cieloecommerce.cielo.com.br/1/sales",
    queryUrl: "https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales",
  },
  production: {
    transactionalUrl: "https://api.cieloecommerce.cielo.com.br/1/sales",
    queryUrl: "https://apiquery.cieloecommerce.cielo.com.br/1/sales",
  },
};

// Get Cielo credentials from environment
const getCieloCredentials = () => ({
  merchantId: process.env.CIELO_MERCHANT_ID || "",
  merchantKey: process.env.CIELO_MERCHANT_KEY || "",
  isSandbox: process.env.CIELO_SANDBOX === "true",
});

function redactSensitive(value) {
  if (!value || typeof value !== "object") return value;

  const cloned = Array.isArray(value) ? [...value] : { ...value };

  if (cloned?.Payment?.CreditCard) {
    const cc = cloned.Payment.CreditCard;
    const number = typeof cc.CardNumber === "string" ? cc.CardNumber : "";
    cloned.Payment.CreditCard = {
      ...cc,
      CardNumber: number ? `${number.slice(0, 6)}******${number.slice(-4)}` : "",
      SecurityCode: cc.SecurityCode ? "***" : cc.SecurityCode,
    };
  }

  return cloned;
}

// Sanitize card fields before sending to Cielo
function sanitizeCardNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function sanitizeSecurityCode(value) {
  return String(value || "").replace(/\D/g, "");
}

function sanitizeHolder(value) {
  if (!value) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^A-Za-z\s]/g, "")     // Keep only letters and spaces
    .trim()
    .substring(0, 25);
}

function validateCardFields(card) {
  const errors = [];
  const cardNumber = sanitizeCardNumber(card?.cardNumber);
  const securityCode = sanitizeSecurityCode(card?.securityCode);
  const holder = sanitizeHolder(card?.holder);
  const expirationDate = card?.expirationDate || "";
  const brand = card?.brand || "";

  if (cardNumber.length < 13 || cardNumber.length > 19) {
    errors.push("Número do cartão inválido");
  }
  if (securityCode.length < 3 || securityCode.length > 4) {
    errors.push("CVV deve ter 3 ou 4 dígitos");
  }
  if (holder.length < 2) {
    errors.push("Nome do titular é obrigatório");
  }
  if (!/^(0[1-9]|1[0-2])\/20\d{2}$/.test(expirationDate)) {
    errors.push("Data de validade inválida (formato MM/AAAA)");
  }
  if (!brand) {
    errors.push("Bandeira do cartão é obrigatória");
  }

  return errors;
}

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
  };

  // PIX: pagamento único, sem cartão
  if (request.paymentType === "pix") {
    const providerFromEnv = process.env.CIELO_PIX_PROVIDER || "";
    const provider = providerFromEnv || (request.isSandbox ? "" : "Cielo2");
    const expirationSecondsRaw = process.env.CIELO_PIX_QRCODE_EXPIRATION || "";
    const expirationSecondsParsed = Number.parseInt(expirationSecondsRaw, 10);
    const expirationSeconds = Number.isNaN(expirationSecondsParsed)
      ? provider
        ? 1800
        : NaN
      : expirationSecondsParsed;

    const payment = {
      Type: "Pix",
      Amount: request.amountInCents,
      Installments: 1,
    };

    if (provider) payment.Provider = provider;
    if (!Number.isNaN(expirationSeconds) && expirationSeconds > 0 && provider) {
      // New PIX provider supports configurable expiration.
      payment.QrCode = { Expiration: expirationSeconds };
    }

    baseRequest.Payment = payment;
  } else {
    // Cartão (simples ou recorrente)
    baseRequest.Payment = {
      Type: "CreditCard",
      Amount: request.amountInCents,
      Installments: request.installments,
      Capture: true,
      SoftDescriptor: "NOVITA",
      CreditCard: {
        CardNumber: sanitizeCardNumber(request.card.cardNumber),
        Holder: sanitizeHolder(request.card.holder),
        ExpirationDate: request.card.expirationDate,
        SecurityCode: sanitizeSecurityCode(request.card.securityCode),
        Brand: request.card.brand,
        SaveCard: request.paymentType === "recurrent",
      },
    };
  }

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

    if (!orderId || !customer || !amountInCents) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (paymentType !== "pix" && !card) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Validate card fields before sending to Cielo
    if (paymentType !== "pix" && card) {
      const validationErrors = validateCardFields(card);
      if (validationErrors.length > 0) {
        console.log("Card validation failed:", validationErrors);
        return res.status(400).json({
          success: false,
          message: validationErrors.join("; "),
          errors: validationErrors,
        });
      }
    }

    const cieloUrls = credentials.isSandbox ? CIELO_CONFIG.sandbox : CIELO_CONFIG.production;
    const cieloRequest = buildCieloRequest({ orderId, customer, card, amountInCents, installments, paymentType, interval, startDate, endDate, isSandbox: credentials.isSandbox });

    console.log("Processing payment for order:", orderId);
    console.log("Cielo request:", JSON.stringify(redactSensitive(cieloRequest), null, 2));
    
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
    console.log("Cielo response (first 500 chars):", responseText.substring(0, 500));

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

    // Handle array response (Cielo returns validation errors as an array)
    // Normalize to object so error-checking works uniformly.
    const cieloResponseObj = Array.isArray(cieloResponse)
      ? { errors: cieloResponse }
      : cieloResponse;

    // Cielo pode retornar 200 mesmo com erro (ex: credenciais inválidas)
    // A API retorna erros em diferentes formatos
    let isCieloError =
      cieloResponseObj.errors ||
      cieloResponseObj.Message ||
      cieloResponseObj.returnMessage ||
      cieloResponseObj.ReturnMessage ||
      cieloResponseObj.message ||
      (cieloResponseObj.Status && cieloResponseObj.Status === 3) ||
      (cieloResponseObj.status && cieloResponseObj.status === 3);

    // Se Status = 3 (negado), é um erro mesmo se Response = 200
    const paymentStatus = cieloResponseObj.Status || cieloResponseObj.status || cieloResponseObj.Payment?.Status || 3;
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
          error_message: JSON.stringify(cieloResponseObj),
          created_at: new Date().toISOString(),
        });
      }

      // Extract error message - Cielo returns errors in different formats
      let errorMsg = "Pagamento negado";
      if (cieloResponseObj.Message) errorMsg = cieloResponseObj.Message;
      else if (cieloResponseObj.returnMessage) errorMsg = cieloResponseObj.returnMessage;
      else if (cieloResponseObj.ReturnMessage) errorMsg = cieloResponseObj.ReturnMessage;
      else if (cieloResponseObj.message) errorMsg = cieloResponseObj.message;
      else if (cieloResponseObj.errors && cieloResponseObj.errors.length > 0) {
        errorMsg = cieloResponseObj.errors.map(e => e.Message || e.message || e).join(", ");
      }

      return res.status(400).json({
        success: false,
        message: errorMsg,
        status: paymentStatus,
        returnCode: cieloResponseObj.ReturnCode || cieloResponseObj.returnCode,
        errors: cieloResponseObj.errors || cieloResponseObj,
      });
    }

    // Extrair dados do pagamento (pode estar em Payment ou no nível raiz)
    const paymentData = cieloResponseObj.Payment || cieloResponseObj;

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
        cielo_response: cieloResponseObj,
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

    // Para PIX, retornamos o objeto no formato da API (inclui QrCodeString/QrCodeBase64Image).
    if (paymentType === "pix") {
      return res.json({
        MerchantOrderId: cieloRequest.MerchantOrderId,
        Customer: cieloRequest.Customer,
        Payment: paymentData,
      });
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

    const response = await fetch(`${cieloUrls.queryUrl}/${paymentId}`, {
      method: "GET",
      headers: {
        "MerchantId": credentials.merchantId,
        "MerchantKey": credentials.merchantKey,
      },
    });

    const cieloResponse = await response.json();

    if (!response.ok) {
      return res.status(400).json({ success: false, message: cieloResponse.Message || "Failed to get payment" });
    }

    const status = cieloResponse?.Payment?.Status ?? -1;
    res.json({
      success: status === 1 || status === 2,
      paymentId: cieloResponse.Payment.PaymentId,
      status: status,
      message: cieloResponse.Payment.ReturnMessage,
    });
  } catch (error) {
    console.error("Get payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Capture Payment
app.post("/api/cielo/payment/:paymentId/capture", async (req, res) => {
  try {
    const credentials = getCieloCredentials();
    const { paymentId } = req.params;
    const { amount } = req.body;

    if (!credentials.merchantId || !credentials.merchantKey) {
      return res.status(500).json({ success: false, message: "Cielo credentials not configured" });
    }

    const cieloUrls = credentials.isSandbox ? CIELO_CONFIG.sandbox : CIELO_CONFIG.production;
    const url = amount
      ? `${cieloUrls.transactionalUrl}/${paymentId}/capture?amount=${amount}`
      : `${cieloUrls.transactionalUrl}/${paymentId}/capture`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "MerchantId": credentials.merchantId,
        "MerchantKey": credentials.merchantKey,
      },
    });

    const cieloResponse = await response.json();
    if (!response.ok) {
      return res.status(400).json({ success: false, message: cieloResponse.Message || "Failed to capture payment" });
    }

    const status = cieloResponse?.Payment?.Status ?? -1;
    res.json({
      success: status === 2,
      paymentId: cieloResponse.Payment.PaymentId,
      status: status,
      message: cieloResponse.Payment.ReturnMessage,
    });
  } catch (error) {
    console.error("Capture payment error:", error);
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

    const url = amount
      ? `${cieloUrls.transactionalUrl}/${paymentId}/void?amount=${amount}`
      : `${cieloUrls.transactionalUrl}/${paymentId}/void`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "MerchantId": credentials.merchantId,
        "MerchantKey": credentials.merchantKey,
      },
    });

    const cieloResponse = await response.json();

    if (!response.ok) {
      return res.status(400).json({ success: false, message: cieloResponse.Message || "Failed to cancel payment" });
    }

    const status = cieloResponse?.Payment?.Status ?? -1;
    res.json({
      success: status === 10,
      paymentId: cieloResponse.Payment.PaymentId,
      status: status,
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
