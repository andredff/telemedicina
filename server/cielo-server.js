// Cielo Payment Server - API 3.0
// https://docs.cielo.com.br/

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: false });

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5174;

app.use(cors());
app.use(express.json());

// ─── Supabase (optional) ────────────────────────────────────────────────────
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
if (supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("✓ Supabase client initialized");
}

// ─── Cielo config ───────────────────────────────────────────────────────────
const isSandbox = process.env.CIELO_SANDBOX === "true";

const CIELO_URLS = isSandbox
  ? {
      transactional: "https://apisandbox.cieloecommerce.cielo.com.br/1/sales",
      query: "https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales",
    }
  : {
      transactional: "https://api.cieloecommerce.cielo.com.br/1/sales",
      query: "https://apiquery.cieloecommerce.cielo.com.br/1/sales",
    };

const MERCHANT_ID  = process.env.CIELO_MERCHANT_ID  || "";
const MERCHANT_KEY = process.env.CIELO_MERCHANT_KEY || "";

const cieloHeaders = {
  "Content-Type": "application/json",
  "MerchantId":   MERCHANT_ID,
  "MerchantKey":  MERCHANT_KEY,
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function stripNonDigits(v)  { return String(v ?? "").replace(/\D/g, ""); }
function sanitizeHolder(v)  {
  return String(v ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z\s]/g, "")
    .trim()
    .substring(0, 25)
    .toUpperCase();
}

function redact(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const c = { ...obj };
  if (c.Payment?.CreditCard) {
    c.Payment = {
      ...c.Payment,
      CreditCard: {
        ...c.Payment.CreditCard,
        CardNumber:   String(c.Payment.CreditCard.CardNumber ?? "").replace(/(\d{6})\d+(\d{4})/, "$1******$2"),
        SecurityCode: "***",
      },
    };
  }
  return c;
}

// Interpreta resposta da Cielo: pode ser array (erros de validação) ou objeto (transação)
function parseCieloResponse(body) {
  if (Array.isArray(body)) {
    // Array de erros de validação: [{Code, Message}, ...]
    return {
      ok: false,
      validationErrors: body,
      payment: null,
    };
  }

  const payment = body.Payment ?? {};
  const status  = payment.Status ?? -1;
  const ok      = status === 1 || status === 2;

  return {
    ok,
    validationErrors: null,
    payment,
    status,
    paymentId:         payment.PaymentId,
    authCode:          payment.AuthorizationCode,
    proofOfSale:       payment.ProofOfSale,
    tid:               payment.Tid,
    returnCode:        payment.ReturnCode,
    returnMessage:     payment.ReturnMessage ?? (ok ? "Autorizado" : "Pagamento negado"),
    recurrentPaymentId: payment.RecurrentPayment?.RecurrentPaymentId,
    raw: body,
  };
}

async function callCielo(method, urlPath, body) {
  const url = urlPath.startsWith("http") ? urlPath : `${CIELO_URLS.transactional}${urlPath}`;
  const opts = {
    method,
    headers: cieloHeaders,
  };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(url, opts);
  const text = await res.text();

  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }

  return { httpStatus: res.status, parsed };
}

// ─── Simulação local (sandbox sem credenciais válidas) ───────────────────────
// Quando CIELO_SANDBOX=true e CIELO_SIMULATE=true, simula resposta da Cielo
// sem precisar de credenciais de sandbox.
// Último dígito do cartão: 0,1,4 = autorizado | 2 = negado | 3 = expirado
const SIMULATE = isSandbox && process.env.CIELO_SIMULATE === "true";

function simulatePayment(cardNumber, amountInCents, paymentType) {
  const lastDigit = parseInt(String(cardNumber).replace(/\D/g, "").slice(-1));
  const authorized = lastDigit === 0 || lastDigit === 1 || lastDigit === 4;
  const denied     = lastDigit === 2;

  if (paymentType === "pix") {
    return {
      success:   true,
      paymentId: `SIM-PIX-${Date.now()}`,
      status:    12,
      message:   "Pix gerado com sucesso (simulação)",
      Payment: {
        Status: 12,
        QrCodeBase64Image: "",
        QrCodeString: "00020101021226870014br.gov.bcb.pix2565pix.example.com/qr/v2/sim5204000053039865802BR5913NOVITA DEMO6009SAO PAULO62290525SIM" + Date.now() + "6304ABCD",
        PaymentId: `SIM-PIX-${Date.now()}`,
      },
    };
  }

  if (!authorized) {
    return {
      success:    false,
      message:    denied ? "Pagamento negado pelo banco" : "Cartão expirado",
      status:     3,
      returnCode: denied ? "05" : "57",
    };
  }

  const paymentId = `SIM-${Date.now()}`;
  return {
    success:           true,
    paymentId,
    authorizationCode: "SIM" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    proofOfSale:       String(Date.now()).slice(-6),
    tid:               paymentId,
    status:            2,
    message:           "Operação realizada com sucesso (simulação)",
    returnCode:        "4",
    recurrentPaymentId: paymentType === "recurrent" ? `SIM-REC-${Date.now()}` : undefined,
  };
}

// ─── POST /api/cielo/payment ─────────────────────────────────────────────────
app.post("/api/cielo/payment", async (req, res) => {
  try {
    if (!MERCHANT_ID || !MERCHANT_KEY) {
      return res.status(500).json({ success: false, message: "Cielo credentials not configured" });
    }

    const { orderId, customer, card, amountInCents, installments = 1, paymentType } = req.body;

    // ── Modo simulação ──────────────────────────────────────────────────────
    if (SIMULATE) {
      const cardNumber = card?.cardNumber || "0";
      console.log(`[Cielo] SIMULATE mode — orderId=${orderId} card=****${String(cardNumber).replace(/\D/g,"").slice(-4)}`);
      const simResult = simulatePayment(cardNumber, amountInCents, paymentType);
      return res.status(simResult.success ? 200 : 400).json(simResult);
    }

    if (!orderId || !customer || !amountInCents) {
      return res.status(400).json({ success: false, message: "Missing required fields: orderId, customer, amountInCents" });
    }

    // ── Monta request Cielo ──────────────────────────────────────────────────
    const cieloReq = {
      MerchantOrderId: String(orderId),
      Customer: {
        Name:         sanitizeHolder(customer.name) || "Cliente",
        Email:        customer.email    || undefined,
        Identity:     customer.cpf     ? stripNonDigits(customer.cpf) : undefined,
        IdentityType: customer.cpf     ? "CPF" : undefined,
        Birthdate:    customer.birthdate || undefined,
        Address: customer.address ? {
          Street:     customer.address.street     || "",
          Number:     customer.address.number     || "S/N",
          Complement: customer.address.complement || undefined,
          District:   customer.address.district   || "",
          City:       customer.address.city       || "",
          State:      customer.address.state      || "",
          ZipCode:    stripNonDigits(customer.address.zipCode || ""),
          Country:    "BRA",
        } : undefined,
      },
      Payment: {
        Type:           "CreditCard",
        Amount:         Number(amountInCents),
        Installments:   Number(installments),
        Capture:        true,
        SoftDescriptor: "NOVITA",
      },
    };

    if (paymentType === "pix") {
      cieloReq.Payment.Type        = "Pix";
      cieloReq.Payment.Installments = 1;
      delete cieloReq.Payment.SoftDescriptor;
    } else {
      if (!card) return res.status(400).json({ success: false, message: "Card data required for credit card payment" });

      const cardNumber   = stripNonDigits(card.cardNumber);
      const securityCode = stripNonDigits(card.securityCode);

      // Validações locais
      if (cardNumber.length < 13 || cardNumber.length > 19) {
        return res.status(400).json({ success: false, message: "Número do cartão inválido" });
      }
      if (securityCode.length < 3 || securityCode.length > 4) {
        return res.status(400).json({ success: false, message: "CVV deve ter 3 ou 4 dígitos" });
      }
      if (!card.brand) {
        return res.status(400).json({ success: false, message: "Bandeira do cartão é obrigatória" });
      }

      cieloReq.Payment.CreditCard = {
        CardNumber:     cardNumber,
        Holder:         sanitizeHolder(card.holder),
        ExpirationDate: card.expirationDate,
        SecurityCode:   securityCode,
        Brand:          card.brand,
        SaveCard:       paymentType === "recurrent",
      };

      if (paymentType === "recurrent") {
        cieloReq.Payment.RecurrentPayment = {
          AuthorizeNow: true,
          Interval:     req.body.interval || "Monthly",
          StartDate:    req.body.startDate || undefined,
          EndDate:      req.body.endDate   || undefined,
        };
      }
    }

    console.log("[Cielo] Request →", JSON.stringify(redact(cieloReq), null, 2));

    // ── Envia para Cielo ─────────────────────────────────────────────────────
    let { httpStatus, parsed } = await callCielo("POST", "", cieloReq);
    console.log("[Cielo] Response ←", httpStatus, JSON.stringify(parsed)?.substring(0, 600));

    // Se erro 319 (Smart Recurrency não habilitada), re-tenta sem recorrência
    if (Array.isArray(parsed) && parsed.some(e => e.Code === 319)) {
      console.log("[Cielo] Smart Recurrency not enabled — retrying as regular credit card");
      delete cieloReq.Payment.RecurrentPayment;
      cieloReq.Payment.CreditCard.SaveCard = false;
      ({ httpStatus, parsed } = await callCielo("POST", "", cieloReq));
      console.log("[Cielo] Retry response ←", httpStatus, JSON.stringify(parsed)?.substring(0, 600));
    }

    if (!parsed) {
      return res.status(502).json({ success: false, message: "Resposta inválida da Cielo" });
    }

    const result = parseCieloResponse(parsed);

    // Erros de validação (array)
    if (result.validationErrors) {
      const message = result.validationErrors.map(e => e.Message || e.message).join("; ");
      return res.status(400).json({ success: false, message, errors: result.validationErrors });
    }

    // Log no Supabase
    if (supabase) {
      await supabase.from("payment_logs").insert({
        order_id:      String(orderId),
        payment_type:  paymentType,
        payment_id:    result.paymentId || null,
        amount:        amountInCents,
        status:        result.ok ? "success" : "failed",
        error_message: result.ok ? null : result.returnMessage,
        cielo_response: parsed,
        created_at:    new Date().toISOString(),
      }).then(() => {}).catch(e => console.warn("[Supabase] Log error:", e.message));
    }

    if (!result.ok) {
      return res.status(400).json({
        success:    false,
        message:    result.returnMessage,
        status:     result.status,
        returnCode: result.returnCode,
        errors:     [{ Code: result.returnCode, Message: result.returnMessage }],
      });
    }

    // PIX: retorna objeto completo com QrCode
    if (paymentType === "pix") {
      return res.json({
        success:    true,
        paymentId:  result.paymentId,
        status:     result.status,
        message:    result.returnMessage,
        Payment:    result.payment,
      });
    }

    return res.json({
      success:            true,
      paymentId:          result.paymentId,
      authorizationCode:  result.authCode,
      proofOfSale:        result.proofOfSale,
      tid:                result.tid,
      status:             result.status,
      message:            result.returnMessage,
      returnCode:         result.returnCode,
      recurrentPaymentId: result.recurrentPaymentId,
    });

  } catch (err) {
    console.error("[Cielo] Internal error:", err);
    return res.status(500).json({ success: false, message: err.message || "Erro interno" });
  }
});

// ─── GET /api/cielo/payment/:paymentId ──────────────────────────────────────
app.get("/api/cielo/payment/:paymentId", async (req, res) => {
  try {
    if (!MERCHANT_ID) return res.status(500).json({ success: false, message: "Cielo not configured" });

    const { paymentId } = req.params;
    const url = `${CIELO_URLS.query}/${paymentId}`;
    const { httpStatus, parsed } = await callCielo("GET", url);

    if (!parsed || httpStatus >= 400) {
      return res.status(400).json({ success: false, message: "Pagamento não encontrado" });
    }

    const result = parseCieloResponse(parsed);
    return res.json({
      success:   result.ok,
      paymentId: result.paymentId,
      status:    result.status,
      message:   result.returnMessage,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/cielo/payment/:paymentId/capture ──────────────────────────────
app.post("/api/cielo/payment/:paymentId/capture", async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount } = req.body;
    const qs  = amount ? `?amount=${amount}` : "";
    const url = `${CIELO_URLS.transactional}/${paymentId}/capture${qs}`;
    const { parsed } = await callCielo("PUT", url);
    const result = parseCieloResponse(parsed ?? {});
    return res.json({ success: result.status === 2, paymentId: result.paymentId, status: result.status, message: result.returnMessage });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/cielo/payment/:paymentId/cancel ───────────────────────────────
app.post("/api/cielo/payment/:paymentId/cancel", async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount } = req.body;
    const qs  = amount ? `?amount=${amount}` : "";
    const url = `${CIELO_URLS.transactional}/${paymentId}/void${qs}`;
    const { parsed } = await callCielo("PUT", url);
    const result = parseCieloResponse(parsed ?? {});
    return res.json({ success: result.status === 10, paymentId: result.paymentId, status: result.status, message: result.returnMessage });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Recurrence management ───────────────────────────────────────────────────
app.put("/api/cielo/recurrence/:id/deactivate", async (req, res) => {
  try {
    const url = `${CIELO_URLS.transactional}/${req.params.id}/deactivate`;
    const { parsed } = await callCielo("PUT", url);
    return res.json({ success: true, ...parsed });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

app.put("/api/cielo/recurrence/:id/reactivate", async (req, res) => {
  try {
    const url = `${CIELO_URLS.transactional}/${req.params.id}/reactivate`;
    const { parsed } = await callCielo("PUT", url);
    return res.json({ success: true, ...parsed });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

app.put("/api/cielo/recurrence/:id/amount", async (req, res) => {
  try {
    const url = `${CIELO_URLS.transactional}/${req.params.id}/amount`;
    await callCielo("PUT", url, req.body.amount);
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

app.put("/api/cielo/recurrence/:id/interval", async (req, res) => {
  try {
    const url = `${CIELO_URLS.transactional}/${req.params.id}/interval`;
    await callCielo("PUT", url, req.body.interval);
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// ─── Webhook ─────────────────────────────────────────────────────────────────
app.post("/api/cielo/webhook", async (req, res) => {
  try {
    const payload = req.body;
    console.log("[Cielo] Webhook:", JSON.stringify(payload));

    if (supabase && payload.PaymentId) {
      const statusMap = { 1: "processing", 2: "processing", 3: "cancelled", 10: "cancelled", 11: "cancelled" };
      const newStatus = statusMap[payload.Status] || "pending";

      await supabase.from("orders")
        .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
        .eq("payment_id", payload.PaymentId);
    }

    return res.json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status:    "ok",
    env:       isSandbox ? "sandbox" : "production",
    merchant:  MERCHANT_ID ? `${MERCHANT_ID.substring(0, 8)}...` : "not configured",
    supabase:  supabase ? "connected" : "not configured",
    cielo:     { transactional: CIELO_URLS.transactional },
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  Cielo Payment Server — API 3.0                      ║
║  http://localhost:${PORT}                                ║
║  Env: ${isSandbox ? "SANDBOX " : "PRODUCTION"} | Merchant: ${MERCHANT_ID.substring(0, 8)}...  ║
╚══════════════════════════════════════════════════════╝
  `);
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT",  () => process.exit(0));
