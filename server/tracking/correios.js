"use strict";

const DEFAULT_API_BASE_URL = "https://api.correios.com.br";
const TRACKING_RESULT_TYPE = process.env.CORREIOS_TRACKING_RESULT_TYPE || "T";
const CHECK_DIGIT_WEIGHTS = [8, 6, 4, 2, 3, 5, 9, 7];

let cachedToken = "";
let cachedTokenExpiresAt = 0;
let cachedTokenKey = "";

function buildCorreiosConfig(overrides = {}) {
  return {
    enabled: overrides.enabled !== false,
    apiBaseUrl: overrides.apiBaseUrl || process.env.CORREIOS_API_BASE_URL || DEFAULT_API_BASE_URL,
    apiToken: overrides.apiToken || process.env.CORREIOS_API_TOKEN || "",
    apiUsername: overrides.apiUsername || process.env.CORREIOS_API_USERNAME || "",
    apiPassword: overrides.apiPassword || process.env.CORREIOS_API_PASSWORD || "",
    postingCard: overrides.postingCard || process.env.CORREIOS_POSTING_CARD || "",
    contractNumber: overrides.contractNumber || process.env.CORREIOS_CONTRACT_NUMBER || "",
    contractDr: overrides.contractDr || process.env.CORREIOS_CONTRACT_DR || "",
    trackingResultType: overrides.trackingResultType || TRACKING_RESULT_TYPE,
  };
}

function normalizeTrackingCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 13);
}

function calculateS10CheckDigit(serial) {
  const sum = serial
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * CHECK_DIGIT_WEIGHTS[index], 0);
  const mod = sum % 11;
  const check = 11 - mod;
  if (check === 10) return "0";
  if (check === 11) return "5";
  return String(check);
}

function validateCorreiosTrackingCode(value) {
  const code = normalizeTrackingCode(value);

  if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code)) {
    return {
      valid: false,
      code,
      message: "Use o formato dos Correios: duas letras, nove números e duas letras. Ex: DG049186226BR.",
    };
  }

  const serial = code.slice(2, 10);
  const expectedDigit = calculateS10CheckDigit(serial);
  const actualDigit = code[10];

  if (expectedDigit !== actualDigit) {
    return {
      valid: false,
      code,
      message: `Dígito verificador inválido. Confira o código antes de salvar.`,
    };
  }

  return { valid: true, code, message: "Código Correios válido." };
}

function getCorreiosTrackingUrl(code) {
  return `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(code)}`;
}

function isCorreiosTrackingConfigured(overrides = {}) {
  const config = buildCorreiosConfig(overrides);
  return Boolean(
    config.enabled &&
    (
      config.apiToken ||
      (
        config.apiUsername &&
        config.apiPassword &&
        config.postingCard
      )
    )
  );
}

async function getCorreiosToken(overrides = {}) {
  const config = buildCorreiosConfig(overrides);

  if (config.apiToken) {
    return config.apiToken;
  }

  const tokenKey = `${config.apiBaseUrl}:${config.apiUsername}:${config.postingCard}:${config.contractNumber}:${config.contractDr}`;
  if (cachedToken && cachedTokenKey === tokenKey && cachedTokenExpiresAt > Date.now() + 60_000) {
    return cachedToken;
  }

  if (!config.apiUsername || !config.apiPassword || !config.postingCard) {
    return "";
  }

  const auth = Buffer.from(`${config.apiUsername}:${config.apiPassword}`).toString("base64");
  const body = {
    numero: config.postingCard,
  };
  if (config.contractNumber) body.contrato = config.contractNumber;
  if (config.contractDr) body.dr = Number(config.contractDr) || config.contractDr;

  const response = await fetch(`${config.apiBaseUrl}/token/v1/autentica/cartaopostagem`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) {
    throw new Error(data?.msgs?.[0] || data?.message || "Falha ao autenticar na API dos Correios");
  }

  cachedToken = data.token;
  cachedTokenKey = tokenKey;
  cachedTokenExpiresAt = data.expiraEm ? new Date(data.expiraEm).getTime() : Date.now() + 50 * 60_000;
  return cachedToken;
}

function mapTrackingStatus(event) {
  const description = String(event?.descricao || "").toLowerCase();
  const code = String(event?.codigo || "").toLowerCase();

  if (description.includes("entregue")) {
    return { status: "delivered", label: "Objeto entregue ao destinatário" };
  }

  if (description.includes("saiu para entrega")) {
    return { status: "out_for_delivery", label: "Objeto saiu para entrega" };
  }

  if (description.includes("aguardando retirada")) {
    return { status: "awaiting_pickup", label: "Objeto aguardando retirada" };
  }

  if (
    description.includes("não entregue") ||
    description.includes("nao entregue") ||
    description.includes("extraviado") ||
    description.includes("endereço incorreto") ||
    description.includes("endereco incorreto") ||
    description.includes("apreendido") ||
    code === "bdi"
  ) {
    return { status: "exception", label: event?.descricao || "Ocorrência na entrega" };
  }

  if (description.includes("postado") || description.includes("recebido pelos correios")) {
    return { status: "posted", label: event?.descricao || "Objeto postado" };
  }

  return { status: "in_transit", label: event?.descricao || "Objeto em trânsito" };
}

function toTrackingEvent(event) {
  const unit = event.unidade || {};
  const destination = event.unidadeDestino || event.destino || {};

  return {
    code: event.codigo || null,
    type: event.tipo || null,
    description: event.descricao || "Evento de rastreamento",
    createdAt: event.dtHrCriado || event.dataHora || null,
    location: [unit.nome, unit.endereco?.cidade || unit.cidade, unit.endereco?.uf || unit.uf]
      .filter(Boolean)
      .join(" - ") || null,
    destination: [destination.nome, destination.endereco?.cidade || destination.cidade, destination.endereco?.uf || destination.uf]
      .filter(Boolean)
      .join(" - ") || null,
  };
}

function normalizeCorreiosResponse(code, data) {
  const object = data?.objetos?.[0] || {};
  const rawEvents = Array.isArray(object.eventos) ? object.eventos : [];
  const events = rawEvents.map(toTrackingEvent);
  const latestEvent = rawEvents[0];

  if (!latestEvent) {
    return {
      configured: true,
      carrier: "correios",
      trackingCode: code,
      trackingStatus: "pending_tracking",
      trackingStatusLabel: object.mensagem || "Objeto ainda sem eventos nos Correios",
      trackingLastEventAt: null,
      trackingEstimatedDelivery: object.dtPrevista || null,
      trackingEvents: events,
      trackingUrl: getCorreiosTrackingUrl(code),
      source: "correios_api",
    };
  }

  const mapped = mapTrackingStatus(latestEvent);

  return {
    configured: true,
    carrier: "correios",
    trackingCode: code,
    trackingStatus: mapped.status,
    trackingStatusLabel: mapped.label,
    trackingLastEventAt: latestEvent.dtHrCriado || latestEvent.dataHora || null,
    trackingEstimatedDelivery: object.dtPrevista || null,
    trackingEvents: events,
    trackingUrl: getCorreiosTrackingUrl(code),
    source: "correios_api",
  };
}

async function queryCorreiosTracking(value, overrides = {}) {
  const config = buildCorreiosConfig(overrides);
  const validation = validateCorreiosTrackingCode(value);
  if (!validation.valid) {
    return {
      configured: false,
      carrier: "correios",
      trackingCode: validation.code,
      trackingStatus: "invalid",
      trackingStatusLabel: validation.message,
      trackingLastEventAt: null,
      trackingEstimatedDelivery: null,
      trackingEvents: [],
      trackingUrl: validation.code ? getCorreiosTrackingUrl(validation.code) : null,
      source: "validation",
    };
  }

  if (!isCorreiosTrackingConfigured(config)) {
    return {
      configured: false,
      carrier: "correios",
      trackingCode: validation.code,
      trackingStatus: "pending_tracking",
      trackingStatusLabel: "Código válido. API Rastro dos Correios ainda não configurada.",
      trackingLastEventAt: null,
      trackingEstimatedDelivery: null,
      trackingEvents: [],
      trackingUrl: getCorreiosTrackingUrl(validation.code),
      source: "manual",
    };
  }

  const token = await getCorreiosToken(config);
  const response = await fetch(
    `${config.apiBaseUrl}/srorastro/v1/objetos/${validation.code}?resultado=${encodeURIComponent(config.trackingResultType || "T")}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      configured: true,
      carrier: "correios",
      trackingCode: validation.code,
      trackingStatus: "unavailable",
      trackingStatusLabel: data?.msgs?.[0] || data?.message || `Correios retornou HTTP ${response.status}`,
      trackingLastEventAt: null,
      trackingEstimatedDelivery: null,
      trackingEvents: [],
      trackingUrl: getCorreiosTrackingUrl(validation.code),
      source: "correios_api",
    };
  }

  return normalizeCorreiosResponse(validation.code, data);
}

function mapTrackingToOrderStatus(currentStatus, trackingStatus) {
  if (currentStatus === "cancelled") return currentStatus;
  if (trackingStatus === "delivered") return "delivered";
  if (["posted", "in_transit", "out_for_delivery", "awaiting_pickup"].includes(trackingStatus)) {
    return "shipped";
  }
  return currentStatus || "processing";
}

module.exports = {
  buildCorreiosConfig,
  getCorreiosTrackingUrl,
  isCorreiosTrackingConfigured,
  mapTrackingToOrderStatus,
  normalizeTrackingCode,
  queryCorreiosTracking,
  validateCorreiosTrackingCode,
};
