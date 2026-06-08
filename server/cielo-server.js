// Cielo Payment Server - API 3.0
// https://docs.cielo.com.br/

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: false });

const express = require("express");
const cors = require("cors");
const { default: rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5174;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(s => s.trim())
  : IS_PRODUCTION
    ? ["https://novita.migrai.com.br", "https://novitahomecare.com.br"]
    : undefined; // undefined = allow all (dev only)

app.use(cors(ALLOWED_ORIGINS ? { origin: ALLOWED_ORIGINS } : undefined));
app.use(express.json());

// ─── Rate limiting ──────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Muitas requisições. Aguarde um momento." },
});
app.use(globalLimiter);

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,             // máx 10 requests por IP por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Muitas tentativas de pagamento. Aguarde um momento." },
});

const emailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  // Limita por usuário autenticado (sub do JWT) ou por IP como fallback
  keyGenerator: (req) => {
    const auth = req.headers.authorization || "";
    const token = auth.replace("Bearer ", "");
    if (token) {
      try {
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
        if (payload?.sub) return `email:user:${payload.sub}`;
      } catch { /* fallback para IP */ }
    }
    return `email:ip:${ipKeyGenerator(req)}`;
  },
  message: { success: false, message: "Muitas requisições de e-mail. Aguarde um momento." },
});

const notificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Muitas requisições de notificação. Aguarde um momento." },
});

// ─── Auth middleware — valida JWT do Supabase ─────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticação obrigatório" });
  }

  const token = authHeader.replace("Bearer ", "");

  // Validate the JWT by calling Supabase auth
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If Supabase is not configured, skip auth in development
    if (!IS_PRODUCTION) return next();
    return res.status(500).json({ error: "Servidor não configurado para autenticação" });
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": supabaseAnonKey,
      },
    });

    if (!response.ok) {
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }

    const user = await response.json();
    req.user = user;
    next();
  } catch (err) {
    console.error("[Auth] Erro ao validar token:", err.message);
    return res.status(401).json({ error: "Erro na validação do token" });
  }
}

// Admin-only middleware (requires requireAuth first)
async function requireAdmin(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  if (!supabase) {
    // If Supabase is not configured, skip in development
    if (!IS_PRODUCTION) return next();
    return res.status(500).json({ error: "Supabase não configurado" });
  }

  try {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", req.user.id)
      .single();

    if (data?.role !== "admin") {
      return res.status(403).json({ error: "Acesso restrito a administradores" });
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: "Erro ao verificar permissões" });
  }
}

// Helper: safe error message (never expose internals in production)
function safeErrorMessage(err) {
  if (IS_PRODUCTION) return "Erro interno do servidor";
  return err.message || "Erro interno";
}

// ─── Webhook secret — proteção contra payloads forjados ──────────────────────
const WEBHOOK_SECRET = process.env.CIELO_WEBHOOK_SECRET || "";

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
const emailTemplates = require("./notifications/templates");

// resendApiKey / resendFrom são declarados em definitivo na seção "Resend Email Proxy"
// (linha ~756), mas inicializamos o dispatcher aqui com os valores de env para o boot.
const _bootResendKey  = process.env.RESEND_API_KEY || "";
const _bootResendFrom = process.env.RESEND_FROM || process.env.VITE_RESEND_FROM || "Novità Telemedicina <onboarding@resend.dev>";

const RESEND_MOCK_MODE = !_bootResendKey;
dispatcher.init(_bootResendKey, RESEND_MOCK_MODE, _bootResendFrom);

// Inicia o scheduler de lembretes de consulta (só se Supabase disponível)
if (supabase) {
  startScheduler(supabase, dispatcher);
}

// ─── Cielo config ───────────────────────────────────────────────────────────
function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function envFlag(value) {
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

const CIELO_SANDBOX_VALUE = readEnv("CIELO_SANDBOX", "VITE_CIELO_SANDBOX");

// Configuração da Cielo — mutável em runtime, com overrides do banco. As URLs
// e headers são recalculados via getters quando uma das credenciais muda.
const cieloConfig = {
  merchantId: readEnv("CIELO_MERCHANT_ID", "VITE_CIELO_MERCHANT_ID", "CIELO_MERCHANTID", "MERCHANT_ID"),
  merchantKey: readEnv("CIELO_MERCHANT_KEY", "VITE_CIELO_MERCHANT_KEY", "CIELO_MERCHANTKEY", "MERCHANT_KEY"),
  sandbox: envFlag(CIELO_SANDBOX_VALUE),
  pixEnabled: true,
  source: "env",
};

function getCieloUrls() {
  return cieloConfig.sandbox
    ? {
        transactional: "https://apisandbox.cieloecommerce.cielo.com.br/1/sales",
        query: "https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales",
      }
    : {
        transactional: "https://api.cieloecommerce.cielo.com.br/1/sales",
        query: "https://apiquery.cieloecommerce.cielo.com.br/1/sales",
      };
}

function getCieloHeaders() {
  return {
    "Content-Type": "application/json",
    "MerchantId": cieloConfig.merchantId,
    "MerchantKey": cieloConfig.merchantKey,
  };
}

// Carrega APENAS o toggle de PIX salvo no banco. Credenciais e ambiente
// (sandbox/produção) são sempre lidos das variáveis de ambiente do servidor
// — gerenciados via Render/host, nunca via UI.
async function loadCieloConfigFromDB() {
  if (!supabase) return;
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "integrations")
      .single();

    if (typeof data?.value?.cieloPixEnabled === "boolean") {
      cieloConfig.pixEnabled = data.value.cieloPixEnabled;
      console.log(`[Cielo] ✓ Toggle PIX carregado do banco (pixEnabled=${cieloConfig.pixEnabled})`);
    }
  } catch {
    // Sem banco ou sem registro — segue com default (PIX habilitado)
  }
}

// Alias para retro-compat com referências antigas
const CIELO_ENV_STATUS = {
  get merchantId() { return Boolean(cieloConfig.merchantId); },
  get merchantKey() { return Boolean(cieloConfig.merchantKey); },
  get sandboxFlag() { return cieloConfig.sandbox ? "true" : "false"; },
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
  const url = urlPath.startsWith("http") ? urlPath : `${getCieloUrls().transactional}${urlPath}`;
  const opts = {
    method,
    headers: getCieloHeaders(),
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
const CIELO_SIMULATE_VALUE = readEnv("CIELO_SIMULATE", "VITE_CIELO_SIMULATE");
// Simulação só é considerada quando a flag de env está ligada. A checagem de
// sandbox é feita dinamicamente via cieloConfig.sandbox no momento do uso.
const SIMULATE_FLAG = envFlag(CIELO_SIMULATE_VALUE);
function isSimulating() { return cieloConfig.sandbox && SIMULATE_FLAG; }

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
app.post("/api/cielo/payment", paymentLimiter, requireAuth, async (req, res) => {
  try {
    if (!cieloConfig.merchantId || !cieloConfig.merchantKey) {
      return res.status(500).json({ success: false, message: "Cielo credentials not configured" });
    }

    const { orderId, customer, card, amountInCents, installments = 1, paymentType } = req.body;

    if (paymentType === "pix" && !cieloConfig.pixEnabled) {
      return res.status(403).json({
        success: false,
        message: "Pagamento via PIX está desabilitado. Habilite em Admin → Configurações → Cielo.",
      });
    }

    // ── Modo simulação ──────────────────────────────────────────────────────
    if (isSimulating()) {
      const cardNumber = card?.cardNumber || "0";
      console.log(`[Cielo] SIMULATE mode — orderId=${orderId} card=****${String(cardNumber).replace(/\D/g,"").slice(-4)}`);
      const simResult = simulatePayment(cardNumber, amountInCents, paymentType);
      return res.status(simResult.success ? 200 : 400).json(simResult);
    }

    if (!orderId || !customer || !amountInCents) {
      return res.status(400).json({ success: false, message: "Missing required fields: orderId, customer, amountInCents" });
    }
    if (typeof amountInCents !== "number" || amountInCents <= 0 || !Number.isInteger(amountInCents)) {
      return res.status(400).json({ success: false, message: "amountInCents deve ser um inteiro positivo" });
    }
    if (!customer.name || typeof customer.name !== "string" || customer.name.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Nome do cliente inválido" });
    }
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      return res.status(400).json({ success: false, message: "E-mail do cliente inválido" });
    }
    if (customer.cpf) {
      const cpfDigits = String(customer.cpf).replace(/\D/g, "");
      if (cpfDigits.length !== 11) {
        return res.status(400).json({ success: false, message: "CPF deve ter 11 dígitos" });
      }
    }

    // ── Idempotência: verifica se já existe pagamento bem-sucedido para este orderId ──
    if (supabase) {
      const { data: existing } = await supabase
        .from("payment_logs")
        .select("payment_id, status")
        .eq("order_id", String(orderId))
        .eq("status", "success")
        .limit(1);

      if (existing && existing.length > 0) {
        if (!IS_PRODUCTION) console.log(`[Cielo] Pagamento duplicado bloqueado — orderId=${orderId} paymentId=${existing[0].payment_id}`);
        return res.json({
          success:   true,
          paymentId: existing[0].payment_id,
          message:   "Pagamento já processado anteriormente",
          duplicate: true,
        });
      }
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

    if (!IS_PRODUCTION) console.log("[Cielo] Request →", JSON.stringify(redact(cieloReq), null, 2));

    // ── Envia para Cielo ─────────────────────────────────────────────────────
    let { httpStatus, parsed } = await callCielo("POST", "", cieloReq);
    if (!IS_PRODUCTION) console.log("[Cielo] Response ←", httpStatus, JSON.stringify(parsed)?.substring(0, 600));

    // Se erro 319 (Smart Recurrency não habilitada), re-tenta sem recorrência
    if (Array.isArray(parsed) && parsed.some(e => e.Code === 319)) {
      if (!IS_PRODUCTION) console.log("[Cielo] Smart Recurrency not enabled — retrying as regular credit card");
      delete cieloReq.Payment.RecurrentPayment;
      cieloReq.Payment.CreditCard.SaveCard = false;
      ({ httpStatus, parsed } = await callCielo("POST", "", cieloReq));
      if (!IS_PRODUCTION) console.log("[Cielo] Retry response ←", httpStatus, JSON.stringify(parsed)?.substring(0, 600));
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
    return res.status(500).json({ success: false, message: safeErrorMessage(err) });
  }
});

// ─── GET /api/cielo/payment/:paymentId ──────────────────────────────────────
app.get("/api/cielo/payment/:paymentId", requireAuth, async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Em modo simulação, IDs PIX simulados (SIM-PIX-*) não existem na Cielo.
    // Retorna status 2 (pago) para que o polling do frontend confirme a venda.
    if (isSimulating() && String(paymentId).startsWith("SIM-")) {
      return res.json({
        success:   true,
        paymentId,
        status:    2,
        message:   "Pagamento confirmado (simulação)",
      });
    }

    const result = await reconcilePaymentStatus(paymentId);
    return res.json({
      success:   result.ok,
      paymentId: result.paymentId,
      status:    result.status,
      message:   result.returnMessage,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(400).json({ success: false, message: "Pagamento não encontrado" });
    }
    if (err.message === "Cielo credentials not configured") {
      return res.status(500).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: safeErrorMessage(err) });
  }
});

// ─── Reconciliação de status: consulta a Cielo e atualiza o Supabase ───────
// Usado pelo polling (GET /payment/:id) e pelo webhook. A Cielo é a fonte de
// verdade — nunca confiamos no payload bruto recebido pelo webhook.
async function reconcilePaymentStatus(paymentId) {
  if (!cieloConfig.merchantId || !cieloConfig.merchantKey) {
    throw new Error("Cielo credentials not configured");
  }

  const { httpStatus, parsed } = await callCielo("GET", `${getCieloUrls().query}/${paymentId}`);
  if (!parsed || httpStatus >= 400) {
    const err = new Error("Pagamento não encontrado");
    err.statusCode = 404;
    throw err;
  }

  const result = parseCieloResponse(parsed);

  // Status 2 = pago. Persiste no Supabase de forma idempotente.
  if (result.status === 2 && supabase && result.paymentId) {
    try {
      const { data: updated } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("payment_id", result.paymentId)
        .neq("payment_status", "paid")
        .select("id")
        .maybeSingle();

      if (updated) {
        console.log(`[Cielo] ✓ Pedido reconciliado: payment_id=${result.paymentId} → paid`);
      }
    } catch (e) {
      console.warn("[Cielo] Falha ao reconciliar pedido:", e.message);
    }
  }

  return result;
}

// ─── Webhook Cielo ──────────────────────────────────────────────────────────
// A Cielo POST para esta URL quando o status de um pagamento muda. O payload
// pode conter PaymentId/RecurrentPaymentId. Não confiamos no payload — sempre
// consultamos a Cielo para obter o status real.
//
// Autenticação: token compartilhado na query string (CIELO_WEBHOOK_TOKEN no
// .env). Como o handler é público (chamado pela Cielo), o token é a única
// camada de defesa contra abuso.
//
// Configuração na Cielo: portal → Loja → Webhooks → URL:
//   https://<seu-host>/api/cielo/webhook?token=<CIELO_WEBHOOK_TOKEN>
const CIELO_WEBHOOK_TOKEN = process.env.CIELO_WEBHOOK_TOKEN || "";

app.post("/api/cielo/webhook", async (req, res) => {
  // 1) Autenticação por token
  if (!CIELO_WEBHOOK_TOKEN) {
    console.warn("[Cielo Webhook] CIELO_WEBHOOK_TOKEN não configurado — rejeitando requisição");
    return res.status(503).json({ error: "Webhook não configurado" });
  }
  if (req.query.token !== CIELO_WEBHOOK_TOKEN) {
    console.warn("[Cielo Webhook] Token inválido — IP=" + req.ip);
    return res.status(401).json({ error: "Token inválido" });
  }

  // 2) Extrai paymentId do payload (formato Cielo: { PaymentId, ChangeType, RecurrentPaymentId? })
  const paymentId = req.body?.PaymentId || req.body?.paymentId;
  if (!paymentId) {
    console.warn("[Cielo Webhook] Payload sem PaymentId:", JSON.stringify(req.body).substring(0, 200));
    // Retorna 200 mesmo assim — a Cielo reenvia em caso de não-2xx, e queremos
    // descartar payloads que não conseguimos processar para não ficar em loop.
    return res.status(200).json({ received: true, ignored: "no PaymentId" });
  }

  // 3) Reconcilia consultando a Cielo (fonte de verdade)
  try {
    const result = await reconcilePaymentStatus(paymentId);
    console.log(`[Cielo Webhook] ${paymentId} → status ${result.status} (${result.returnMessage})`);
    return res.status(200).json({ received: true, paymentId, status: result.status });
  } catch (err) {
    console.error("[Cielo Webhook] Erro ao reconciliar:", err.message);
    // Retorna 200 para evitar retry infinito de pagamentos inválidos. Se for
    // erro transitório (rede, 5xx da Cielo), a Cielo reenvia depois.
    if (err.statusCode === 404) {
      return res.status(200).json({ received: true, ignored: "payment not found" });
    }
    return res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ─── POST /api/cielo/payment/:paymentId/capture ──────────────────────────────
app.post("/api/cielo/payment/:paymentId/capture", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount } = req.body;
    const qs  = amount ? `?amount=${amount}` : "";
    const url = `${getCieloUrls().transactional}/${paymentId}/capture${qs}`;
    const { parsed } = await callCielo("PUT", url);
    const result = parseCieloResponse(parsed ?? {});
    return res.json({ success: result.status === 2, paymentId: result.paymentId, status: result.status, message: result.returnMessage });
  } catch (err) {
    return res.status(500).json({ success: false, message: safeErrorMessage(err) });
  }
});

// ─── POST /api/cielo/payment/:paymentId/cancel ───────────────────────────────
app.post("/api/cielo/payment/:paymentId/cancel", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount } = req.body;
    const qs  = amount ? `?amount=${amount}` : "";
    const url = `${getCieloUrls().transactional}/${paymentId}/void${qs}`;
    const { parsed } = await callCielo("PUT", url);
    const result = parseCieloResponse(parsed ?? {});
    return res.json({ success: result.status === 10, paymentId: result.paymentId, status: result.status, message: result.returnMessage });
  } catch (err) {
    return res.status(500).json({ success: false, message: safeErrorMessage(err) });
  }
});

// ─── Recurrence management ───────────────────────────────────────────────────
app.put("/api/cielo/recurrence/:id/deactivate", requireAuth, async (req, res) => {
  try {
    const url = `${getCieloUrls().transactional}/${req.params.id}/deactivate`;
    const { parsed } = await callCielo("PUT", url);
    return res.json({ success: true, ...parsed });
  } catch (err) { return res.status(500).json({ success: false, message: safeErrorMessage(err) }); }
});

app.put("/api/cielo/recurrence/:id/reactivate", requireAuth, async (req, res) => {
  try {
    const url = `${getCieloUrls().transactional}/${req.params.id}/reactivate`;
    const { parsed } = await callCielo("PUT", url);
    return res.json({ success: true, ...parsed });
  } catch (err) { return res.status(500).json({ success: false, message: safeErrorMessage(err) }); }
});

app.put("/api/cielo/recurrence/:id/amount", requireAuth, async (req, res) => {
  try {
    const url = `${getCieloUrls().transactional}/${req.params.id}/amount`;
    await callCielo("PUT", url, req.body.amount);
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ success: false, message: safeErrorMessage(err) }); }
});

app.put("/api/cielo/recurrence/:id/interval", requireAuth, async (req, res) => {
  try {
    const url = `${getCieloUrls().transactional}/${req.params.id}/interval`;
    await callCielo("PUT", url, req.body.interval);
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ success: false, message: safeErrorMessage(err) }); }
});

// ─── Webhook ─────────────────────────────────────────────────────────────────
// P5: Autenticação via secret na query string
// P6: Confirma status real com GET na Cielo antes de persistir
// P7: Mapeamento completo de status (inclui 12, 13, 20)
app.post("/api/cielo/webhook", async (req, res) => {
  try {
    // Em produção o WEBHOOK_SECRET é obrigatório — rejeita se não configurado
    if (IS_PRODUCTION && !WEBHOOK_SECRET) {
      console.error("[Cielo] Webhook bloqueado — CIELO_WEBHOOK_SECRET não configurado em produção");
      return res.status(500).json({ error: "Webhook não configurado" });
    }
    // Valida secret quando definido
    if (WEBHOOK_SECRET) {
      const providedSecret = req.query.secret || req.headers["x-webhook-secret"];
      if (providedSecret !== WEBHOOK_SECRET) {
        console.warn("[Cielo] Webhook rejeitado — secret inválido", { ip: req.ip });
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const payload = req.body;
    if (!IS_PRODUCTION) console.log("[Cielo] Webhook recebido:", JSON.stringify(payload));

    if (!supabase || !payload.PaymentId) {
      return res.json({ received: true });
    }

    // P6 — Consulta Cielo para confirmar o status real da transação
    let confirmedStatus = payload.Status;
    if (cieloConfig.merchantId && cieloConfig.merchantKey) {
      try {
        const queryUrl = `${getCieloUrls().query}/${payload.PaymentId}`;
        const { parsed } = await callCielo("GET", queryUrl);
        if (parsed?.Payment?.Status !== undefined) {
          confirmedStatus = parsed.Payment.Status;
          console.log(`[Cielo] Webhook status confirmado via API: payload=${payload.Status} → real=${confirmedStatus}`);
        } else {
          console.warn("[Cielo] Não foi possível confirmar status via API — usando payload do webhook");
        }
      } catch (err) {
        console.warn("[Cielo] Erro ao confirmar status via API:", err.message, "— usando payload do webhook");
      }
    }

    // P7 — Mapeamento completo de status Cielo → status do pedido
    const statusMap = {
      1:  "processing",  // Autorizado
      2:  "processing",  // Capturado/Pago
      3:  "cancelled",   // Negado
      10: "cancelled",   // Cancelado (Void)
      11: "cancelled",   // Estornado (Refund)
      12: "pending",     // Pendente (PIX aguardando)
      13: "cancelled",   // Abortado
      20: "processing",  // Agendado (Recorrência)
    };
    const newStatus = statusMap[confirmedStatus] || "pending";

    await supabase.from("orders")
      .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
      .eq("payment_id", payload.PaymentId);

    if (!IS_PRODUCTION) console.log(`[Cielo] Webhook processado — PaymentId=${payload.PaymentId} status=${confirmedStatus} → ${newStatus}`);
    return res.json({ received: true });
  } catch (err) {
    console.error("[Cielo] Webhook erro:", err.message);
    return res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ─── Resend Email Proxy ───────────────────────────────────────────────────────
// Proxy para Resend API. Mantém a chave no servidor (nunca exposta ao frontend).
// A chave pode ser atualizada em runtime via /api/integrations/resend.
let resendApiKey = process.env.RESEND_API_KEY || "";
let resendFrom   = process.env.RESEND_FROM || process.env.VITE_RESEND_FROM || "Novità Telemedicina <onboarding@resend.dev>";

// Carrega chave do Resend salva no banco (se existir, sobrescreve a do .env)
async function loadResendKeyFromDB() {
  if (!supabase) return;
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "integrations")
      .single();

    if (data?.value?.resendApiKey) {
      resendApiKey = data.value.resendApiKey;
      console.log("[Resend] ✓ API key carregada do banco de dados");
    }
    if (data?.value?.resendFromEmail) {
      resendFrom = data.value.resendFromEmail;
    }
  } catch (err) {
    // Não bloqueia inicialização — usa .env como fallback
    console.log("[Resend] Usando API key do .env (nenhuma salva no banco)");
  }
}
loadResendKeyFromDB();
loadCieloConfigFromDB();

// ─── Endpoint: testar conexão Resend ────────────────────────────────────────
app.post("/api/integrations/resend/test", requireAuth, requireAdmin, async (req, res) => {
  const { apiKey, to, from: fromOverride } = req.body;
  const keyToTest = apiKey || resendApiKey;
  const toEmail   = to || "novitahealth@gmail.com";
  const fromEmail = fromOverride || resendFrom;

  if (!keyToTest) {
    return res.status(400).json({ success: false, error: "Nenhuma API key fornecida" });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${keyToTest}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: "Teste de Email — Novità Telemedicina",
        html: `<p>Email de teste enviado com sucesso pelo painel admin da Novità Telemedicina.</p><p><small>Enviado em: ${new Date().toLocaleString("pt-BR")}</small></p>`,
      }),
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 401) {
      return res.json({ success: false, error: "API key inválida ou sem permissão de envio" });
    }

    if (!response.ok) {
      return res.json({ success: false, error: body.message || `Erro HTTP ${response.status}` });
    }

    return res.json({ success: true, id: body.id, to: toEmail });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Endpoint: status da integração Resend ──────────────────────────────────
app.get("/api/integrations/resend/status", requireAuth, requireAdmin, (_req, res) => {
  res.json({
    configured: Boolean(resendApiKey),
    from: resendFrom,
    source: resendApiKey
      ? (resendApiKey === process.env.RESEND_API_KEY ? "env" : "database")
      : "none",
  });
});

// ─── Callback: atualizar chave em runtime (chamado após save no admin) ──────
app.post("/api/integrations/resend/reload", requireAuth, requireAdmin, async (_req, res) => {
  await loadResendKeyFromDB();

  // Reinicializa o dispatcher com a nova chave (nunca mock se tiver chave)
  const mockMode = !resendApiKey;
  dispatcher.init(resendApiKey, mockMode, resendFrom);

  res.json({ success: true, configured: Boolean(resendApiKey) });
});

// ─── Endpoint: status da integração Cielo ───────────────────────────────────
app.get("/api/integrations/cielo/status", requireAuth, requireAdmin, (_req, res) => {
  res.json({
    configured: Boolean(cieloConfig.merchantId && cieloConfig.merchantKey),
    merchantId: cieloConfig.merchantId
      ? `${cieloConfig.merchantId.substring(0, 8)}...${cieloConfig.merchantId.slice(-4)}`
      : null,
    environment: cieloConfig.sandbox ? "sandbox" : "production",
    sandbox: cieloConfig.sandbox,
    pixEnabled: cieloConfig.pixEnabled,
    simulating: isSimulating(),
    source: cieloConfig.source,
    urls: getCieloUrls(),
  });
});

// ─── Endpoint: testar conexão Cielo ─────────────────────────────────────────
// Faz uma consulta a um paymentId inexistente usando as credenciais do
// servidor (env vars). Cielo retorna 401/403 se inválidas, 404 se OK.
app.post("/api/integrations/cielo/test", requireAuth, requireAdmin, async (_req, res) => {
  if (!cieloConfig.merchantId || !cieloConfig.merchantKey) {
    return res.status(400).json({
      success: false,
      error: "Credenciais Cielo não configuradas no servidor (CIELO_MERCHANT_ID / CIELO_MERCHANT_KEY)",
    });
  }

  const queryUrl = `${getCieloUrls().query}/00000000-0000-0000-0000-000000000000`;

  try {
    const response = await fetch(queryUrl, {
      method: "GET",
      headers: getCieloHeaders(),
    });

    if (response.status === 401 || response.status === 403) {
      return res.json({
        success: false,
        error: "MerchantId/MerchantKey inválidos para o ambiente atual",
      });
    }

    // 404 é o resultado esperado: Cielo aceitou as credenciais e disse que o
    // pagamento não existe. Qualquer 2xx/4xx fora de 401/403 indica que
    // estamos autenticados.
    return res.json({
      success: true,
      environment: cieloConfig.sandbox ? "sandbox" : "production",
      httpStatus: response.status,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Endpoint: recarregar configuração Cielo do banco ───────────────────────
app.post("/api/integrations/cielo/reload", requireAuth, requireAdmin, async (_req, res) => {
  await loadCieloConfigFromDB();
  res.json({
    success: true,
    configured: Boolean(cieloConfig.merchantId && cieloConfig.merchantKey),
    sandbox: cieloConfig.sandbox,
    pixEnabled: cieloConfig.pixEnabled,
    source: cieloConfig.source,
  });
});

app.post("/api/resend/emails", emailLimiter, requireAuth, async (req, res) => {
  const { to, subject, html, from } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Campos obrigatórios: to, subject, html" });
  }

  if (!resendApiKey) {
    // Modo simulado: registra no log mas não envia
    console.log("[Resend] ⚠️  RESEND_API_KEY não configurada — simulando envio");
    console.log(`[Resend] → Para: ${Array.isArray(to) ? to.join(", ") : to}`);
    console.log(`[Resend] → Assunto: ${subject}`);
    return res.json({ id: `sim_${Date.now()}`, simulated: true });
  }

  // Override de dev: redireciona todo envio para a caixa de teste do Resend.
  // O Resend em modo sandbox (onboarding@resend.dev) só aceita envios para a
  // conta verificada. Em dev, preservamos o destinatário original no assunto
  // para facilitar a identificação durante os testes.
  const devInbox = !IS_PRODUCTION ? (process.env.RESEND_DEV_TO_OVERRIDE || "") : "";
  const originalTo = Array.isArray(to) ? to.join(", ") : String(to);
  const effectiveTo = devInbox ? [devInbox] : (Array.isArray(to) ? to : [to]);
  const effectiveSubject = devInbox ? `[DEV → ${originalTo}] ${subject}` : subject;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: from || resendFrom,
        to:   effectiveTo,
        subject: effectiveSubject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Resend] Erro:", data);
      return res.status(response.status).json({ error: data });
    }

    if (!IS_PRODUCTION) {
      const redirected = devInbox ? ` (redirecionado de ${originalTo})` : "";
      console.log(`[Resend] ✓ Email enviado — id: ${data.id} → ${effectiveTo[0]}${redirected}`);
    }
    return res.json(data);
  } catch (err) {
    console.error("[Resend] Falha na requisição:", err.message);
    return res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ─── Logistics — service order notification ──────────────────────────────────
// Cria/garante a OS e envia e-mail operacional para a equipe configurada.

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEmailList(value) {
  return String(value || "")
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

async function getLogisticsNotificationSettings() {
  const envRecipients = normalizeEmailList(
    process.env.LOGISTICS_NOTIFICATION_EMAIL ||
    process.env.NOTIFICATION_EMAIL ||
    ""
  );

  const fallback = {
    enabled: true,
    recipients: envRecipients,
    source: envRecipients.length > 0 ? "env" : "none",
  };

  if (!supabase) return fallback;

  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "notifications")
      .single();

    if (error || !data?.value) return fallback;

    const recipients = normalizeEmailList(data.value.logisticsEmail || data.value.notificationEmail);
    return {
      enabled: data.value.enableEmailNotifications !== false,
      recipients: recipients.length > 0 ? recipients : envRecipients,
      source: recipients.length > 0 ? "site_settings" : fallback.source,
    };
  } catch (err) {
    console.warn("[Logistics] Não foi possível carregar configurações de notificação:", err.message);
    return fallback;
  }
}

function renderLogisticsServiceOrderEmail(serviceOrder) {
  const itemRows = serviceOrder.items.map((item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${Number(item.quantity || 0)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.prescriptionId || "-")}</td>
    </tr>
  `).join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="margin: 0 0 12px; color: #0f766e;">Nova ordem de serviço logística</h1>
      <p style="margin: 0 0 20px;">Um novo pedido de medicamentos foi confirmado e precisa de separação/entrega.</p>

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px;"><strong>Pedido:</strong> ${escapeHtml(serviceOrder.orderId)}</p>
        <p style="margin: 0 0 8px;"><strong>Criado em:</strong> ${escapeHtml(new Date(serviceOrder.createdAt).toLocaleString("pt-BR"))}</p>
        <p style="margin: 0;"><strong>Prioridade:</strong> ${escapeHtml(serviceOrder.priority || "normal")}</p>
      </div>

      <h2 style="font-size: 18px; margin: 0 0 8px;">Paciente</h2>
      <p style="margin: 0 0 4px;"><strong>Nome:</strong> ${escapeHtml(serviceOrder.customer.name)}</p>
      <p style="margin: 0 0 4px;"><strong>E-mail:</strong> ${escapeHtml(serviceOrder.customer.email || "-")}</p>
      <p style="margin: 0 0 16px;"><strong>Telefone:</strong> ${escapeHtml(serviceOrder.customer.phone || "-")}</p>

      <h2 style="font-size: 18px; margin: 0 0 8px;">Entrega</h2>
      <p style="margin: 0 0 16px;">${escapeHtml(serviceOrder.customer.address)}</p>

      <h2 style="font-size: 18px; margin: 0 0 8px;">Itens</h2>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #ecfdf5;">
            <th align="left" style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Medicamento</th>
            <th align="center" style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Qtd.</th>
            <th align="left" style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Receita</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <p style="margin: 16px 0 0;"><strong>Observações:</strong> ${escapeHtml(serviceOrder.notes || "-")}</p>
    </div>
  `;
}

async function sendLogisticsEmail({ to, subject, html }) {
  if (!resendApiKey) {
    console.warn("[Logistics] RESEND_API_KEY não configurada — e-mail de OS não enviado");
    return {
      emailSent: false,
      message: "OS criada, mas e-mail não enviado: Resend não configurado",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: resendFrom,
      to,
      subject,
      html,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("[Logistics] Resend erro:", data);
    return {
      emailSent: false,
      message: data?.message || `OS criada, mas e-mail não enviado: HTTP ${response.status}`,
    };
  }

  return {
    emailSent: true,
    emailId: data.id,
    message: "OS criada e e-mail enviado para logística",
  };
}

app.post("/api/logistics/service-orders", notificationLimiter, requireAuth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase não configurado no servidor" });
  }

  const serviceOrder = req.body || {};
  const orderId = String(serviceOrder.orderId || "").trim();
  const customer = serviceOrder.customer || {};
  const items = Array.isArray(serviceOrder.items) ? serviceOrder.items : [];

  if (!orderId || !customer.name || !customer.address || items.length === 0) {
    return res.status(400).json({
      error: "Campos obrigatórios: orderId, customer.name, customer.address, items",
    });
  }

  try {
    const now = new Date().toISOString();
    const createdAt = serviceOrder.createdAt || now;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: "Pedido não encontrado para criação da OS" });
    }

    if (order.user_id && req.user?.id && order.user_id !== req.user.id) {
      return res.status(403).json({ error: "Pedido não pertence ao usuário autenticado" });
    }

    const orderRecord = {
      order_id: orderId,
      customer_name: customer.name,
      customer_email: customer.email || null,
      customer_phone: customer.phone || null,
      delivery_address: customer.address,
      items,
      status: "pending",
      created_at: createdAt,
      updated_at: now,
    };

    const { data: existing } = await supabase
      .from("logistics_service_orders")
      .select("id")
      .eq("order_id", orderId)
      .limit(1);

    let serviceOrderId = existing?.[0]?.id;

    if (serviceOrderId) {
      const { error: updateError } = await supabase
        .from("logistics_service_orders")
        .update(orderRecord)
        .eq("id", serviceOrderId);

      if (updateError) throw updateError;
    } else {
      const { data, error } = await supabase
        .from("logistics_service_orders")
        .insert(orderRecord)
        .select("id")
        .single();

      if (error) throw error;
      serviceOrderId = data?.id;
    }

    const settings = await getLogisticsNotificationSettings();
    if (!settings.enabled) {
      return res.status(201).json({
        success: true,
        serviceOrderId,
        emailSent: false,
        message: "OS criada, mas notificações por e-mail estão desativadas",
      });
    }

    if (settings.recipients.length === 0) {
      return res.status(201).json({
        success: true,
        serviceOrderId,
        emailSent: false,
        message: "OS criada, mas nenhum e-mail de logística está configurado",
      });
    }

    const subject = `Nova OS de medicamentos - Pedido ${orderId}`;
    const html = renderLogisticsServiceOrderEmail({
      ...serviceOrder,
      orderId,
      createdAt,
      customer,
      items,
      priority: serviceOrder.priority || "normal",
      notes: serviceOrder.notes || "Medicamentos controlados - requer assinatura na entrega",
    });

    const emailResult = await sendLogisticsEmail({
      to: settings.recipients,
      subject,
      html,
    });

    return res.status(201).json({
      success: true,
      serviceOrderId,
      notificationTo: settings.recipients,
      notificationSource: settings.source,
      ...emailResult,
    });
  } catch (err) {
    console.error("[Logistics] Erro ao criar/notificar OS:", err.message);
    return res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ─── OS: render server-side (mantido como referência) ───────────────────────
// A OS é renderizada pelo front (página /admin/pedidos/:id/os) lendo direto
// da tabela logistics_service_orders via supabaseAdmin. Esta função fica
// disponível caso futuramente precisemos gerar PDFs server-side.
// eslint-disable-next-line no-unused-vars
function renderServiceOrderDocument(os) {
  const items = Array.isArray(os.items) ? os.items : [];
  const itemRows = items.map((item, i) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;width:48px;color:#6b7280;">${i + 1}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name || "")}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;width:80px;">${Number(item.quantity || 0)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;width:160px;">${escapeHtml(item.prescriptionId || "—")}</td>
    </tr>
  `).join("");

  const createdAt = os.created_at
    ? new Date(os.created_at).toLocaleString("pt-BR")
    : "—";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>OS — Pedido ${escapeHtml(os.order_id)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #111827; }
  .toolbar { position: sticky; top: 0; background: #1f2937; color: #fff; padding: 12px 24px; display: flex; gap: 12px; align-items: center; justify-content: space-between; z-index: 10; }
  .toolbar .info { font-size: 13px; opacity: .85; }
  .toolbar button { background: #0ea5e9; color: #fff; border: 0; padding: 8px 16px; font-size: 14px; font-weight: 600; border-radius: 6px; cursor: pointer; }
  .toolbar button:hover { background: #0284c7; }
  .doc { background: #fff; max-width: 210mm; margin: 24px auto; padding: 32mm 20mm; box-shadow: 0 4px 24px rgba(0,0,0,.08); border-radius: 4px; }
  .doc header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px; }
  .doc h1 { font-size: 22px; margin: 0 0 4px; color: #0f766e; }
  .doc .subtitle { color: #6b7280; font-size: 13px; }
  .doc .meta { text-align: right; font-size: 12px; color: #6b7280; line-height: 1.7; }
  .doc .meta strong { color: #111827; }
  .doc section { margin-bottom: 22px; }
  .doc h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; margin: 0 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .doc .field { margin: 4px 0; font-size: 14px; }
  .doc .field strong { display: inline-block; min-width: 110px; color: #374151; }
  .doc table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 4px; }
  .doc th { background: #ecfdf5; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: #065f46; border-bottom: 2px solid #10b981; }
  .doc .footer-note { margin-top: 32px; padding: 16px; background: #fef3c7; border-left: 4px solid #f59e0b; font-size: 13px; color: #78350f; border-radius: 4px; }
  .doc .signature { margin-top: 48px; display: flex; justify-content: space-around; }
  .doc .signature .line { width: 220px; border-top: 1px solid #111827; padding-top: 6px; text-align: center; font-size: 12px; color: #6b7280; }
  .status-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: #fef3c7; color: #92400e; }
  .status-pill.delivered { background: #d1fae5; color: #065f46; }
  @media print {
    .toolbar { display: none; }
    body { background: #fff; }
    .doc { margin: 0; box-shadow: none; max-width: none; padding: 16mm 14mm; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <div class="info">OS do Pedido <strong>${escapeHtml(os.order_id)}</strong></div>
    <button onclick="window.print()">Imprimir / Salvar como PDF</button>
  </div>

  <div class="doc">
    <header>
      <div>
        <h1>Ordem de Serviço Logística</h1>
        <div class="subtitle">Novità Health Group — Separação e Entrega de Medicamentos</div>
      </div>
      <div class="meta">
        <div><strong>OS Nº</strong> ${escapeHtml(os.id || "—")}</div>
        <div><strong>Pedido</strong> ${escapeHtml(os.order_id)}</div>
        <div><strong>Emitida em</strong> ${escapeHtml(createdAt)}</div>
        <div><strong>Status</strong> <span class="status-pill ${escapeHtml(os.status || "pending")}">${escapeHtml((os.status || "pending").toUpperCase())}</span></div>
      </div>
    </header>

    <section>
      <h2>Paciente</h2>
      <div class="field"><strong>Nome:</strong> ${escapeHtml(os.customer_name || "—")}</div>
      <div class="field"><strong>E-mail:</strong> ${escapeHtml(os.customer_email || "—")}</div>
      <div class="field"><strong>Telefone:</strong> ${escapeHtml(os.customer_phone || "—")}</div>
    </section>

    <section>
      <h2>Endereço de Entrega</h2>
      <div class="field">${escapeHtml(os.delivery_address || "—")}</div>
    </section>

    <section>
      <h2>Itens para Separação (${items.length})</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Medicamento</th>
            <th style="text-align:center;">Qtd.</th>
            <th>Receita</th>
          </tr>
        </thead>
        <tbody>${itemRows || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#6b7280;">Nenhum item registrado.</td></tr>`}</tbody>
      </table>
    </section>

    <div class="footer-note">
      <strong>⚠ Atenção:</strong> Medicamentos controlados — requer assinatura do paciente ou responsável na entrega. Conferir documento com foto antes de entregar.
    </div>

    <div class="signature">
      <div class="line">Responsável pela Separação</div>
      <div class="line">Responsável pela Entrega</div>
    </div>
  </div>
</body>
</html>`;
}

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

async function dispararNotificacaoPedido({ pedidoId, email, nomeUsuario, statusAnterior, novoStatus, items }) {
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

  // Renderiza template completo com identidade visual
  const { subject, html } = emailTemplates.notificacaoPedido({
    nome:         nomeUsuario,
    pedidoId,
    status:       novoStatus,
    mensagem:     mensagemOpcional,
  });

  // Registra notificação no banco
  const sentAt = new Date().toISOString();
  if (supabase) {
    await supabase.from("order_notifications").insert({
      order_id:       pedidoId,
      customer_email: email,
      customer_name:  nomeUsuario,
      status:         novoStatus,
      subject,
      body:           html,
      sent_at:        sentAt,
    }).catch(err => console.error("[Notificação] Erro ao registrar log:", err.message));
  }

  // Envia via dispatcher (suporta Mailpit em dev e Resend em prod)
  dispatcher.dispatch("NotificacaoPedido", {
    nome:         nomeUsuario,
    email,
    pedidoId,
    status:       novoStatus,
    mensagem:     mensagemOpcional,
  });
  console.log(`[Notificação] 📧 Email enfileirado → ${email} (pedido ${pedidoId})`);
}

// ─── Admin: reset de senha ────────────────────────────────────────────────────
// Envia e-mail de recuperação de senha para o usuário via Supabase Auth Admin API
app.post("/api/admin/users/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase não configurado no servidor" });
  }

  const { id } = req.params;

  try {
    // Busca o email do usuário pelo profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", id)
      .single();

    if (profileError || !profile?.email) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Usa o cliente Supabase com service role para chamar a Auth Admin API
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: "Credenciais Supabase não configuradas" });
    }

    // Gera link de recuperação de senha via Admin API
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ email: profile.email, email_confirm: true }),
    });

    // Envia o e-mail de recuperação via resetPasswordForEmail
    const resetResponse = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email: profile.email }),
    });

    if (!resetResponse.ok) {
      const err = await resetResponse.json().catch(() => ({}));
      return res.status(500).json({ error: err.msg || "Falha ao enviar e-mail de recuperação" });
    }

    if (!IS_PRODUCTION) console.log(`[Admin] Reset de senha enviado para ${profile.email} (userId=${id})`);
    return res.json({ success: true, email: profile.email });
  } catch (err) {
    console.error("[Admin] Erro ao resetar senha:", err.message);
    return res.status(500).json({ error: safeErrorMessage(err) });
  }
});

app.put("/api/orders/:id/status", requireAuth, requireAdmin, async (req, res) => {
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
      .select("id, status, customer_email, customer_name, items")
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
        items:         pedido.items || [],
      }).catch(err => console.error("[Notificação] Erro no worker:", err.message));
    });

  } catch (err) {
    console.error("[Orders] Erro ao atualizar status:", err.message);
    return res.status(500).json({ error: safeErrorMessage(err) });
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
 * Body: { tipo: "UsuarioCadastrado" | "SenhaAlterada" | "ConsultaAgendada" | ..., data: { ... } }
 */
app.post("/api/notifications/events", notificationLimiter, requireAuth, (req, res) => {
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
app.post("/api/notifications/consulta-agendada", notificationLimiter, requireAuth, async (req, res) => {
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
app.get("/api/notifications/stats", requireAuth, requireAdmin, (_req, res) => {
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
 * Param:  tipo — UsuarioCadastrado | SenhaAlterada | ConsultaAgendada | LembreteConsulta | NotificacaoPedido
 * Body:   { email } (opcional — usa padrão se omitido)
 */
app.post("/api/notifications/test/:tipo", requireAuth, requireAdmin, (req, res) => {
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
    NotificacaoPedido: {
      nome:     "André Tester",
      email:    dest,
      pedidoId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      status:   "shipped",
      mensagem: "Seu pedido saiu para entrega e chegará em breve!",
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
    env:           cieloConfig.sandbox ? "sandbox" : "production",
    merchant:      cieloConfig.merchantId ? `${cieloConfig.merchantId.substring(0, 8)}...` : "not configured",
    supabase:      supabase ? "connected" : "not configured",
    cielo:         {
      transactional: getCieloUrls().transactional,
      query: getCieloUrls().query,
      configured: CIELO_ENV_STATUS.merchantId && CIELO_ENV_STATUS.merchantKey,
      hasMerchantId: CIELO_ENV_STATUS.merchantId,
      hasMerchantKey: CIELO_ENV_STATUS.merchantKey,
      sandbox: cieloConfig.sandbox,
      simulate: isSimulating(),
    },
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

// ─── PDF Proxy ────────────────────────────────────────────────────────────────
// Busca um PDF externo e serve como blob,
// evitando bloqueio de CORS/X-Frame-Options no iframe do frontend.
//
// Busca um PDF na origem testando múltiplas estratégias de auth (Memed exige token).
// Retorna { ok, buffer, status }.
async function fetchPdfWithAuth(url) {
  const memedToken = process.env.MEMED_SECRET_TOKEN || process.env.MEMED_API_KEY || "";
  const attempts = [
    { label: "no-auth", headers: { Accept: "application/pdf,*/*" } },
  ];
  if (memedToken) {
    attempts.push({ label: "memed-bearer", headers: { Accept: "application/pdf,*/*", Authorization: `Bearer ${memedToken}` } });
    attempts.push({ label: "memed-x-api-key", headers: { Accept: "application/pdf,*/*", "X-API-Key": memedToken } });
  }

  let lastStatus = 0;
  for (const attempt of attempts) {
    try {
      const response = await fetch(url, { headers: attempt.headers, signal: AbortSignal.timeout(15000) });
      lastStatus = response.status;
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        console.log(`[proxy/pdf] sucesso com estratégia="${attempt.label}" (${buffer.byteLength} bytes)`);
        return { ok: true, buffer, status: response.status };
      }
      console.warn(`[proxy/pdf] tentativa "${attempt.label}" retornou ${response.status}`);
    } catch (err) {
      console.error(`[proxy/pdf] tentativa "${attempt.label}" falhou:`, err.message);
    }
  }
  return { ok: false, status: lastStatus };
}

// GET /api/proxy/pdf?url=<encoded_url>&orderId=<id>
// Se orderId for fornecido e o upload for bem-sucedido, faz cache em Supabase Storage
// e atualiza orders.receita_url_pdf para a URL pública (próximas chamadas pulam a Memed).
app.get("/api/proxy/pdf", requireAuth, async (req, res) => {
  const { url, orderId } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Parâmetro 'url' obrigatório." });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "URL inválida." });
  }

  if (parsed.protocol !== "https:") {
    return res.status(400).json({ error: "Apenas URLs HTTPS são permitidas." });
  }

  const result = await fetchPdfWithAuth(url);

  if (!result.ok) {
    return res.status(502).json({ error: `Origem retornou ${result.status || "erro"}. Verifique credenciais Memed.` });
  }

  const buffer = Buffer.from(result.buffer);

  // Cache no Supabase Storage se temos orderId e service-role configurado
  if (orderId && supabase && typeof orderId === "string") {
    try {
      const path = `${orderId}.pdf`;
      const { error: upErr } = await supabase.storage.from("receitas").upload(path, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (upErr) {
        console.error("[proxy/pdf] Falha ao salvar no Storage:", upErr.message);
      } else {
        const { data: pub } = supabase.storage.from("receitas").getPublicUrl(path);
        if (pub?.publicUrl) {
          const { error: updErr } = await supabase.from("orders").update({ receita_url_pdf: pub.publicUrl }).eq("id", orderId);
          if (updErr) {
            console.error("[proxy/pdf] Falha ao atualizar orders.receita_url_pdf:", updErr.message);
          } else {
            console.log(`[proxy/pdf] PDF cacheado em Storage e orders.${orderId} atualizado → ${pub.publicUrl}`);
          }
        }
      }
    } catch (cacheErr) {
      console.error("[proxy/pdf] Erro no cache:", cacheErr.message);
    }
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=\"receita.pdf\"");
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(buffer);
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  const emailMode = RESEND_MOCK_MODE ? "MOCK (console)" : "RESEND (live)";
  const groqStatus  = process.env.GROQ_API_KEY        ? "configurado" : "não configurado";
  const ollamaInfo  = "ver /api/receitas/status";
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Novità — Backend Server                                 ║
║  http://localhost:${PORT}                                    ║
║                                                          ║
║  Pagamentos: ${cieloConfig.sandbox ? "SANDBOX " : "PRODUCTION"} | Cielo ${cieloConfig.merchantId ? cieloConfig.merchantId.substring(0, 8) + "..." : "não configurado"}          ║
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
