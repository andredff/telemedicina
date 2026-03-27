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

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(s => s.trim())
  : undefined; // undefined = allow all (dev)

app.use(cors(ALLOWED_ORIGINS ? { origin: ALLOWED_ORIGINS } : undefined));
app.use(express.json());

// ─── Supabase (optional) ────────────────────────────────────────────────────
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
if (supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("✓ Supabase client initialized");
}

// ─── Receitas — OCR + IA + Matching ─────────────────────────────────────────
// Disponibiliza supabase para os handlers de receita via app.locals
app.locals.supabase = supabase;
const receitasRouter = require("./receitas/index");
app.use("/api/receitas", receitasRouter);

// ─── Sistema de Notificações por E-mail ────────────────────────────────────
const dispatcher = require("./notifications/dispatcher");
const { startScheduler } = require("./notifications/scheduler");

const RESEND_MOCK_MODE = !process.env.RESEND_API_KEY || process.env.NODE_ENV === "development";
dispatcher.init(process.env.RESEND_API_KEY, RESEND_MOCK_MODE);

// Inicia o scheduler de lembretes de consulta (só se Supabase disponível)
if (supabase) {
  startScheduler(supabase, dispatcher);
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

// ─── Resend Email Proxy ───────────────────────────────────────────────────────
// Proxy para Resend API. Mantém a chave no servidor (nunca exposta ao frontend).
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM    = process.env.RESEND_FROM || "Novità Telemedicina <onboarding@resend.dev>";

app.post("/api/resend/emails", async (req, res) => {
  const { to, subject, html, from } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Campos obrigatórios: to, subject, html" });
  }

  if (!RESEND_API_KEY) {
    // Modo simulado: registra no log mas não envia
    console.log("[Resend] ⚠️  RESEND_API_KEY não configurada — simulando envio");
    console.log(`[Resend] → Para: ${Array.isArray(to) ? to.join(", ") : to}`);
    console.log(`[Resend] → Assunto: ${subject}`);
    return res.json({ id: `sim_${Date.now()}`, simulated: true });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: from || RESEND_FROM,
        to:   Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Resend] Erro:", data);
      return res.status(response.status).json({ error: data });
    }

    console.log(`[Resend] ✓ Email enviado — id: ${data.id} → ${Array.isArray(to) ? to[0] : to}`);
    return res.json(data);
  } catch (err) {
    console.error("[Resend] Falha na requisição:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Orders — atualização de status com evento de notificação ─────────────────
// Endpoint desacoplado: atualiza o DB e dispara notificação de forma assíncrona.
// O request retorna imediatamente; o email é enviado em background.

const STATUS_VALIDOS = ["pending", "processing", "shipped", "delivered", "cancelled"];

const MENSAGENS_STATUS = {
  pending:    "Recebemos seu pedido e já estamos verificando os detalhes.",
  processing: "Estamos preparando seu pedido com cuidado.",
  shipped:    "Seu pedido já está a caminho 🚚",
  delivered:  "Seu pedido foi entregue com sucesso 🎉",
  cancelled:  "Seu pedido foi cancelado. Se precisar, estamos aqui.",
};

async function dispararNotificacaoPedido({ pedidoId, email, nomeUsuario, statusAnterior, novoStatus, trackingCode, items }) {
  // Idempotência: verifica se já foi notificado para este status recentemente (5 min)
  if (supabase) {
    const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existente } = await supabase
      .from("order_notifications")
      .select("id")
      .eq("order_id", pedidoId)
      .eq("status", novoStatus)
      .gte("sent_at", cincoMinAtras)
      .limit(1);

    if (existente && existente.length > 0) {
      console.log(`[Notificação] ⚠️  Duplicada ignorada — pedido ${pedidoId} status ${novoStatus}`);
      return;
    }
  }

  const mensagemOpcional = MENSAGENS_STATUS[novoStatus] || "";

  console.log(`[Notificação] 🔔 Evento: PedidoStatusAtualizado`, {
    pedidoId,
    statusAnterior,
    novoStatus,
    dataHora: new Date().toISOString(),
  });

  // Registra notificação no banco
  const sentAt = new Date().toISOString();
  if (supabase) {
    await supabase.from("order_notifications").insert({
      order_id:       pedidoId,
      customer_email: email,
      customer_name:  nomeUsuario,
      status:         novoStatus,
      subject:        `Atualização do pedido #${pedidoId.substring(0, 8)} — ${novoStatus}`,
      body:           mensagemOpcional,
      tracking_code:  trackingCode || null,
      sent_at:        sentAt,
    }).catch(err => console.error("[Notificação] Erro ao registrar log:", err.message));
  }

  // Envia email com retry (até 3 tentativas)
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      // Chama o próprio endpoint Resend (reutiliza a lógica já centralizada)
      const baseUrl = `http://localhost:${process.env.PORT || 5174}`;
      const resp = await fetch(`${baseUrl}/api/resend/emails`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to:      [email],
          subject: `Atualização do pedido #${pedidoId.substring(0, 8).toUpperCase()} — Novità`,
          html:    `<p>Olá, ${nomeUsuario}!</p><p>${mensagemOpcional}</p>`,
        }),
      });

      if (resp.ok) {
        console.log(`[Notificação] 📧 Email enviado (tentativa ${tentativa}) → ${email}`);
        console.log({ pedidoId, status: "EMAIL_ENVIADO", timestamp: new Date() });
        return;
      }

      console.warn(`[Notificação] Tentativa ${tentativa} falhou — status ${resp.status}`);
    } catch (err) {
      console.warn(`[Notificação] Tentativa ${tentativa} — erro: ${err.message}`);
    }

    if (tentativa < 3) await new Promise(r => setTimeout(r, 1000 * tentativa));
  }

  console.error(`[Notificação] ❌ Email não enviado após 3 tentativas — pedido ${pedidoId}`);
}

app.put("/api/orders/:id/status", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase não configurado no servidor" });
  }

  const { id } = req.params;
  const { novoStatus } = req.body;

  if (!STATUS_VALIDOS.includes(novoStatus)) {
    return res.status(400).json({ error: `Status inválido: ${novoStatus}` });
  }

  try {
    // Busca pedido atual
    const { data: pedido, error: fetchErr } = await supabase
      .from("orders")
      .select("id, status, customer_email, customer_name, tracking_code, items")
      .eq("id", id)
      .single();

    if (fetchErr || !pedido) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    // Valida se houve mudança real de status
    if (pedido.status === novoStatus) {
      return res.json({ changed: false, message: "Status não alterado (já era este valor)" });
    }

    const statusAnterior = pedido.status;

    // Persiste alteração
    await supabase
      .from("orders")
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    // Retorna imediatamente — não bloqueia o request
    res.json({ changed: true, statusAnterior, novoStatus });

    // Dispara evento de domínio de forma assíncrona (fire-and-forget com retry)
    setImmediate(() => {
      dispararNotificacaoPedido({
        pedidoId:      pedido.id,
        email:         pedido.customer_email || "",
        nomeUsuario:   pedido.customer_name  || "Cliente",
        statusAnterior,
        novoStatus,
        trackingCode:  pedido.tracking_code,
        items:         pedido.items || [],
      }).catch(err => console.error("[Notificação] Erro no worker:", err.message));
    });

  } catch (err) {
    console.error("[Orders] Erro ao atualizar status:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Notificações — Rotas de Eventos ─────────────────────────────────────────
// Todas as rotas são desacopladas: aceitam o payload, enfileiram o e-mail
// e retornam imediatamente sem bloquear.

/**
 * POST /api/notifications/events
 * Endpoint genérico para despachar qualquer evento de domínio.
 * Usado por webhooks do Supabase Auth e integrações internas.
 *
 * Body: { tipo: "UsuarioCadastrado" | "SenhaAlterada" | ..., data: { ... } }
 */
app.post("/api/notifications/events", (req, res) => {
  const { tipo, data } = req.body || {};

  if (!tipo || !data) {
    return res.status(400).json({ error: "Campos obrigatórios: tipo, data" });
  }

  try {
    const jobId = dispatcher.dispatch(tipo, data);
    logEventoAsync(tipo, data, jobId);
    return res.status(202).json({ accepted: true, jobId });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/notifications/consulta-agendada
 * Registra uma nova consulta para lembrete automático (30 min antes).
 *
 * Body: {
 *   consultaId, email, nome, especialidade, profissional,
 *   dataHora (ISO 8601), userId (opcional)
 * }
 */
app.post("/api/notifications/consulta-agendada", async (req, res) => {
  const { consultaId, email, nome, especialidade, profissional, dataHora, userId } = req.body || {};

  if (!consultaId || !email || !nome || !dataHora) {
    return res.status(400).json({ error: "Campos obrigatórios: consultaId, email, nome, dataHora" });
  }

  // 1. Dispara notificação imediata de confirmação
  try {
    const jobId = dispatcher.dispatch("ConsultaAgendada", {
      email, nome, especialidade, profissional,
      dataHora: formatarDataHoraLocal(dataHora),
      consultaId,
    });
    logEventoAsync("ConsultaAgendada", { email, nome }, jobId);
  } catch (err) {
    console.error("[Notificação] Erro ao despachar ConsultaAgendada:", err.message);
  }

  // 2. Registra no banco para o scheduler de lembrete
  if (supabase) {
    const { error: dbErr } = await supabase
      .from("consultation_reminders")
      .insert({
        consultation_id: String(consultaId),
        user_id:         userId || null,
        user_email:      email.toLowerCase().trim(),
        user_name:       nome,
        especialidade:   especialidade || null,
        profissional:    profissional  || null,
        scheduled_at:    new Date(dataHora).toISOString(),
        reminder_sent:   false,
      })
      .select("id")
      .single();

    if (dbErr) {
      console.error("[Scheduler] Erro ao registrar lembrete:", dbErr.message);
      // Não falha o request — confirmação foi enviada
    }
  }

  return res.status(202).json({
    accepted:         true,
    confirmacaoEnviada: true,
    lembreteAgendado: !!supabase,
  });
});

/**
 * GET /api/notifications/stats
 * Retorna métricas da fila de e-mails.
 */
app.get("/api/notifications/stats", (_req, res) => {
  res.json({
    queue:    dispatcher.queueStatus(),
    modo:     RESEND_MOCK_MODE ? "MOCK (sem RESEND_API_KEY)" : "RESEND",
    scheduler: supabase ? "ativo" : "inativo (Supabase não configurado)",
  });
});

/**
 * POST /api/notifications/test/:tipo
 * Dispara um evento de teste com dados sintéticos.
 * Útil para verificar templates localmente.
 *
 * Param:  tipo — UsuarioCadastrado | SenhaAlterada | ConsultaAgendada | LembreteConsulta
 * Body:   { email } (opcional — usa padrão se omitido)
 */
app.post("/api/notifications/test/:tipo", (req, res) => {
  const { tipo }  = req.params;
  const { email } = req.body || {};

  const dest = email || "teste@novita.com.br";

  const FIXTURES = {
    UsuarioCadastrado: {
      nome:  "André Tester",
      email: dest,
    },
    SenhaAlterada: {
      nome:    "André Tester",
      email:   dest,
      dataHora: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    },
    ConsultaAgendada: {
      nome:          "André Tester",
      email:         dest,
      especialidade: "Clínico Geral",
      profissional:  "Dr. Carlos Silva",
      dataHora:      formatarDataHoraLocal(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()),
      consultaId:    "99999",
    },
    LembreteConsulta: {
      nome:          "André Tester",
      email:         dest,
      especialidade: "Cardiologia",
      profissional:  "Dra. Ana Oliveira",
      dataHora:      formatarDataHoraLocal(new Date(Date.now() + 30 * 60 * 1000).toISOString()),
      consultaId:    "99998",
    },
  };

  if (!FIXTURES[tipo]) {
    return res.status(400).json({
      error: "Tipo inválido",
      tiposValidos: Object.keys(FIXTURES),
    });
  }

  try {
    const jobId = dispatcher.dispatch(tipo, FIXTURES[tipo]);
    return res.status(202).json({ accepted: true, jobId, dest, tipo });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ─── Helper: log assíncrono de eventos no Supabase ────────────────────────────
function logEventoAsync(tipo, data, jobId) {
  if (!supabase) return;
  supabase
    .from("notification_events_log")
    .insert({
      event_type: tipo,
      recipient:  data.email || "unknown",
      job_id:     jobId,
      payload:    data,
    })
    .then()
    .catch(err => console.error("[EventLog] Erro ao logar evento:", err.message));
}

// ─── Helper: formata data/hora no fuso de São Paulo ───────────────────────────
function formatarDataHoraLocal(isoString) {
  try {
    return new Date(isoString).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status:        "ok",
    env:           isSandbox ? "sandbox" : "production",
    merchant:      MERCHANT_ID ? `${MERCHANT_ID.substring(0, 8)}...` : "not configured",
    supabase:      supabase ? "connected" : "not configured",
    cielo:         { transactional: CIELO_URLS.transactional },
    notifications: {
      modo:    RESEND_MOCK_MODE ? "MOCK" : "RESEND",
      queue:   dispatcher.queueStatus(),
    },
  });
});

// ─── /api/receitas/extrair — alias para o novo pipeline ──────────────────────
// Mantém compatibilidade retroativa. O pipeline completo (OCR + IA + matching)
// está em /api/receitas/analisar (server/receitas/index.js).
// Este endpoint delega internamente e adapta a resposta ao formato antigo.
const multerLegacy = require("multer");
const uploadLegacy = multerLegacy({ storage: multerLegacy.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.post("/api/receitas/extrair", uploadLegacy.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const { extractText }        = require("./receitas/ocr");
    const { extractMedications } = require("./receitas/ai");

    const ocrResult = await extractText(file.buffer, file.mimetype);
    if (!ocrResult.text || ocrResult.text.trim().length < 10) {
      return res.status(422).json({ error: "Não foi possível extrair texto do arquivo." });
    }

    const aiResult = await extractMedications(ocrResult.text);

    // Retorna no formato legado esperado pelo frontend anterior
    return res.json({
      medicamentos: aiResult.medicamentos,
      provider: aiResult.provider,
    });
  } catch (err) {
    console.error("[receitas/extrair] Erro:", err);
    return res.status(500).json({ error: "Erro interno ao processar a receita." });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const emailMode = RESEND_MOCK_MODE ? "MOCK (console)" : "RESEND (live)";
  const groqStatus  = process.env.GROQ_API_KEY        ? "configurado" : "não configurado";
  const ollamaInfo  = "ver /api/receitas/status";
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Novità — Backend Server                                 ║
║  http://localhost:${PORT}                                    ║
║                                                          ║
║  Pagamentos: ${isSandbox ? "SANDBOX " : "PRODUCTION"} | Cielo ${MERCHANT_ID ? MERCHANT_ID.substring(0, 8) + "..." : "não configurado"}          ║
║  E-mails:    ${emailMode.padEnd(32)}║
║  Supabase:   ${(supabase ? "conectado" : "não configurado").padEnd(32)}║
║                                                          ║
║  Receitas — OCR + IA + Matching:                         ║
║  POST /api/receitas/analisar        (arquivo)            ║
║  POST /api/receitas/analisar-texto  (texto colado)       ║
║  GET  /api/receitas/status          (provedores IA)      ║
║  Groq:   ${groqStatus.padEnd(42)}║
║  Ollama: ${ollamaInfo.padEnd(42)}║
║                                                          ║
║  Endpoints de notificação:                               ║
║  POST /api/notifications/events                          ║
║  POST /api/notifications/consulta-agendada               ║
║  POST /api/notifications/test/:tipo                      ║
║  GET  /api/notifications/stats                           ║
╚══════════════════════════════════════════════════════════╝
  `);
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT",  () => process.exit(0));
