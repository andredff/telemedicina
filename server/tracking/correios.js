"use strict";

const DEFAULT_API_BASE_URL = "https://api.correios.com.br";
const TRACKING_RESULT_TYPE = process.env.CORREIOS_TRACKING_RESULT_TYPE || "T";
const DEFAULT_PAC_SERVICE_CODE = "03298";
const DEFAULT_SEDEX_SERVICE_CODE = "03220";
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
    originCep: overrides.originCep || process.env.CORREIOS_ORIGIN_CEP || "",
    pacServiceCode: overrides.pacServiceCode || process.env.CORREIOS_PAC_SERVICE_CODE || DEFAULT_PAC_SERVICE_CODE,
    sedexServiceCode: overrides.sedexServiceCode || process.env.CORREIOS_SEDEX_SERVICE_CODE || DEFAULT_SEDEX_SERVICE_CODE,
    priceApiPath: overrides.priceApiPath || process.env.CORREIOS_PRICE_API_PATH || "/preco/v1/nacional",
    deadlineApiPath: overrides.deadlineApiPath || process.env.CORREIOS_DEADLINE_API_PATH || "/prazo/v1/nacional",
  };
}

function normalizeCep(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
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

function isCorreiosShippingConfigured(overrides = {}) {
  const config = buildCorreiosConfig(overrides);
  return isCorreiosTrackingConfigured(config) && normalizeCep(config.originCep).length === 8;
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

function buildCorreiosUrl(config, path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${String(config.apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "")}/${String(path).replace(/^\/+/, "")}`;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
  );
}

function parseCorreiosMoney(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "")
    .trim()
    .replace(/[^\d,.-]/g, "");

  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCorreiosDeadline(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function asCorreiosArray(data, keys = []) {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  if (data && typeof data === "object" && data.coProduto) return [data];
  return [];
}

function getCorreiosErrorMessage(row) {
  if (!row || typeof row !== "object") return "";
  if (Array.isArray(row.msgs) && row.msgs[0]) return row.msgs[0];
  return row.txErro || row.msgErro || row.mensagem || row.message || row.erro || "";
}

function buildShippingServices(config) {
  const services = [
    {
      key: "sedex",
      id: "correios-sedex",
      name: "SEDEX",
      description: "Entrega expressa pelos Correios",
      serviceCode: String(config.sedexServiceCode || DEFAULT_SEDEX_SERVICE_CODE),
    },
    {
      key: "pac",
      id: "correios-pac",
      name: "PAC",
      description: "Entrega econômica pelos Correios",
      serviceCode: String(config.pacServiceCode || DEFAULT_PAC_SERVICE_CODE),
    },
  ];

  const seen = new Set();
  return services.filter((service) => {
    if (!service.serviceCode || seen.has(service.serviceCode)) return false;
    seen.add(service.serviceCode);
    return true;
  });
}

function normalizeShippingPackage(params = {}) {
  const itemCount = Math.max(Number(params.itemCount || 1), 1);
  const weightKg = Math.max(Number(params.weight || itemCount * 0.3), 0.1);
  return {
    weightGrams: Math.max(Math.ceil(weightKg * 1000), 200),
    length: Math.max(Math.ceil(Number(params.length || 20)), 16),
    width: Math.max(Math.ceil(Number(params.width || 15)), 11),
    height: Math.max(Math.ceil(Number(params.height || 10)), 2),
  };
}

function normalizeShippingOptions(services, priceData, deadlineData) {
  const priceRows = asCorreiosArray(priceData, ["parametrosProduto", "produtos", "itens", "data"]);
  const deadlineRows = asCorreiosArray(deadlineData, ["parametrosPrazo", "prazos", "itens", "data"]);

  return services
    .map((service) => {
      const priceRow = priceRows.find((row) => String(row?.coProduto) === service.serviceCode) || {};
      const deadlineRow = deadlineRows.find((row) => String(row?.coProduto) === service.serviceCode) || {};
      const errorMessage = getCorreiosErrorMessage(priceRow) || getCorreiosErrorMessage(deadlineRow);
      const price = parseCorreiosMoney(
        priceRow.pcFinal ?? priceRow.precoFinal ?? priceRow.preco ?? priceRow.valor ?? priceRow.vlPreco
      );
      const deadline = parseCorreiosDeadline(
        deadlineRow.prazoEntrega ?? deadlineRow.nuPrazo ?? deadlineRow.prazo ?? deadlineRow.prazoEntregaDomiciliar
      );

      if (errorMessage || price === null || deadline === null) {
        return null;
      }

      return {
        id: service.id,
        name: service.name,
        description: service.description,
        price: Math.round(price * 100) / 100,
        deadline,
        carrier: "Correios",
        serviceCode: service.serviceCode,
        source: "correios_api",
        estimatedDelivery: deadlineRow.dataMaxima || deadlineRow.dtPrevista || deadlineRow.dataPrevista || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.price - b.price);
}

async function postCorreiosJson(config, path, token, body) {
  const response = await fetch(buildCorreiosUrl(config, path), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.msgs?.[0] || data?.message || data?.erro || `Correios retornou HTTP ${response.status}`);
  }
  return data;
}

async function queryCorreiosShippingQuote(params = {}, overrides = {}) {
  const config = buildCorreiosConfig(overrides);
  const destinationCep = normalizeCep(params.destinationCep || params.zipCode);
  const originCep = normalizeCep(config.originCep);

  if (destinationCep.length !== 8) {
    return {
      success: false,
      configured: false,
      options: [],
      message: "CEP de destino inválido.",
    };
  }

  if (!isCorreiosShippingConfigured(config)) {
    return {
      success: true,
      configured: false,
      options: [],
      message: originCep
        ? "API de Preço/Prazo dos Correios ainda não configurada."
        : "Configure o CEP de origem e as credenciais dos Correios no painel admin.",
    };
  }

  const services = buildShippingServices(config);
  const packageData = normalizeShippingPackage(params);
  const token = await getCorreiosToken(config);
  const idLote = `novita-${Date.now()}`;

  const sharedContract = {
    nuContrato: config.contractNumber || undefined,
    nuDR: config.contractDr ? Number(config.contractDr) || config.contractDr : undefined,
  };

  const parametrosProduto = services.map((service, index) => compactObject({
    coProduto: service.serviceCode,
    nuRequisicao: String(index + 1).padStart(4, "0"),
    ...sharedContract,
    cepOrigem: originCep,
    cepDestino: destinationCep,
    psObjeto: String(packageData.weightGrams),
    nuUnidade: "",
    tpObjeto: "2",
    comprimento: String(packageData.length),
    largura: String(packageData.width),
    altura: String(packageData.height),
  }));

  const parametrosPrazo = services.map((service, index) => compactObject({
    coProduto: service.serviceCode,
    nuRequisicao: String(index + 1).padStart(4, "0"),
    cepOrigem: originCep,
    cepDestino: destinationCep,
  }));

  const [priceData, deadlineData] = await Promise.all([
    postCorreiosJson(config, config.priceApiPath, token, { idLote, parametrosProduto }),
    postCorreiosJson(config, config.deadlineApiPath, token, { idLote, parametrosPrazo }),
  ]);

  const options = normalizeShippingOptions(services, priceData, deadlineData);

  return {
    success: true,
    configured: true,
    options,
    message: options.length > 0
      ? "Frete calculado pelos Correios."
      : "Correios não retornou modalidades disponíveis para este CEP.",
  };
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
  isCorreiosShippingConfigured,
  isCorreiosTrackingConfigured,
  mapTrackingToOrderStatus,
  normalizeTrackingCode,
  queryCorreiosShippingQuote,
  queryCorreiosTracking,
  validateCorreiosTrackingCode,
};
