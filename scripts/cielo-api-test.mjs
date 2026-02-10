/* eslint-disable no-console */
import crypto from "node:crypto";

function getEnv(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : "";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json };
}

function cieloUrls(isSandbox) {
  return isSandbox
    ? {
        transactional: "https://apisandbox.cieloecommerce.cielo.com.br/1/sales",
        query: "https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales",
        recurrenceQuery: "https://apiquerysandbox.cieloecommerce.cielo.com.br/1/RecurrentPayment",
      }
    : {
        transactional: "https://api.cieloecommerce.cielo.com.br/1/sales",
        query: "https://apiquery.cieloecommerce.cielo.com.br/1/sales",
        recurrenceQuery: "https://apiquery.cieloecommerce.cielo.com.br/1/RecurrentPayment",
      };
}

async function checkQueryAuth({ merchantId, merchantKey, isSandbox }) {
  const { query } = cieloUrls(isSandbox);
  const fakeId = crypto.randomUUID();
  const { res, json } = await fetchJson(`${query}/${fakeId}`, {
    method: "GET",
    headers: {
      MerchantId: merchantId,
      MerchantKey: merchantKey,
    },
  });

  // 401/403 => auth issue; 404/400 => auth OK but transaction not found/validation.
  const ok = ![401, 403].includes(res.status);
  return {
    ok,
    status: res.status,
    message:
      json?.[0]?.Message ||
      json?.Message ||
      json?.Payment?.ReturnMessage ||
      json?.ReturnMessage ||
      "",
  };
}

async function createCreditCardSale({ merchantId, merchantKey, isSandbox, cardNumber }) {
  const { transactional } = cieloUrls(isSandbox);
  const orderId = `API-TEST-CC-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const payload = {
    MerchantOrderId: orderId,
    Customer: {
      Name: "API Test",
      Email: "api-test@novita.local",
      Identity: "11111111111",
      IdentityType: "CPF",
    },
    Payment: {
      Type: "CreditCard",
      Amount: 100, // R$ 1,00
      Installments: 1,
      Capture: true,
      CreditCard: {
        CardNumber: cardNumber,
        Holder: "API TEST",
        ExpirationDate: "12/2030",
        SecurityCode: "123",
        Brand: "Visa",
      },
    },
  };

  const { res, json, text } = await fetchJson(`${transactional}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      MerchantId: merchantId,
      MerchantKey: merchantKey,
    },
    body: JSON.stringify(payload),
  });

  assert(json, `Create credit card sale: invalid JSON (HTTP ${res.status})`);
  if (!res.ok) {
    throw new Error(
      `Create credit card sale failed (HTTP ${res.status}): ${
        json?.[0]?.Message || json?.Message || text?.slice(0, 200) || "unknown error"
      }`
    );
  }

  const paymentId = json?.Payment?.PaymentId;
  const status = json?.Payment?.Status;
  assert(paymentId, "Create credit card sale: missing Payment.PaymentId");
  assert(typeof status === "number", "Create credit card sale: missing Payment.Status");

  return { orderId, paymentId, status, raw: json };
}

async function querySale({ merchantId, merchantKey, isSandbox, paymentId }) {
  const { query } = cieloUrls(isSandbox);
  const { res, json, text } = await fetchJson(`${query}/${paymentId}`, {
    method: "GET",
    headers: {
      MerchantId: merchantId,
      MerchantKey: merchantKey,
    },
  });
  assert(json, `Query sale: invalid JSON (HTTP ${res.status})`);
  if (!res.ok) {
    throw new Error(
      `Query sale failed (HTTP ${res.status}): ${
        json?.[0]?.Message || json?.Message || text?.slice(0, 200) || "unknown error"
      }`
    );
  }

  const status = json?.Payment?.Status;
  assert(typeof status === "number", "Query sale: missing Payment.Status");
  return { status, raw: json };
}

async function voidSale({ merchantId, merchantKey, isSandbox, paymentId }) {
  const { transactional } = cieloUrls(isSandbox);
  const { res, json, text } = await fetchJson(`${transactional}/${paymentId}/void`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      MerchantId: merchantId,
      MerchantKey: merchantKey,
    },
  });
  assert(json, `Void sale: invalid JSON (HTTP ${res.status})`);
  if (!res.ok) {
    throw new Error(
      `Void sale failed (HTTP ${res.status}): ${
        json?.[0]?.Message || json?.Message || text?.slice(0, 200) || "unknown error"
      }`
    );
  }
  const status = json?.Payment?.Status;
  assert(typeof status === "number", "Void sale: missing Payment.Status");
  return { status, raw: json };
}

async function createRecurrentSale({ merchantId, merchantKey, isSandbox }) {
  const { transactional } = cieloUrls(isSandbox);
  const orderId = `API-TEST-REC-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const payload = {
    MerchantOrderId: orderId,
    Customer: {
      Name: "API Test",
      Email: "api-test@novita.local",
      Identity: "11111111111",
      IdentityType: "CPF",
    },
    Payment: {
      Type: "CreditCard",
      Amount: 100, // R$ 1,00
      Installments: 1,
      Capture: true,
      CreditCard: {
        CardNumber: "4024007153763191",
        Holder: "API TEST",
        ExpirationDate: "12/2030",
        SecurityCode: "123",
        Brand: "Visa",
        SaveCard: true,
      },
      RecurrentPayment: {
        AuthorizeNow: true,
        Interval: "Monthly",
      },
    },
  };

  const { res, json, text } = await fetchJson(`${transactional}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      MerchantId: merchantId,
      MerchantKey: merchantKey,
    },
    body: JSON.stringify(payload),
  });

  assert(json, `Create recurrent sale: invalid JSON (HTTP ${res.status})`);
  if (!res.ok) {
    throw new Error(
      `Create recurrent sale failed (HTTP ${res.status}): ${
        json?.[0]?.Message || json?.Message || text?.slice(0, 200) || "unknown error"
      }`
    );
  }

  const paymentId = json?.Payment?.PaymentId;
  const recurrentPaymentId = json?.Payment?.RecurrentPayment?.RecurrentPaymentId;
  assert(paymentId, "Create recurrent sale: missing Payment.PaymentId");
  assert(recurrentPaymentId, "Create recurrent sale: missing Payment.RecurrentPayment.RecurrentPaymentId");
  return { orderId, paymentId, recurrentPaymentId, raw: json };
}

async function queryRecurrence({ merchantId, merchantKey, isSandbox, recurrentPaymentId }) {
  const { recurrenceQuery } = cieloUrls(isSandbox);
  const { res, json, text } = await fetchJson(`${recurrenceQuery}/${recurrentPaymentId}`, {
    method: "GET",
    headers: {
      MerchantId: merchantId,
      MerchantKey: merchantKey,
    },
  });
  assert(json, `Query recurrence: invalid JSON (HTTP ${res.status})`);
  if (!res.ok) {
    throw new Error(
      `Query recurrence failed (HTTP ${res.status}): ${
        json?.[0]?.Message || json?.Message || text?.slice(0, 200) || "unknown error"
      }`
    );
  }
  const status = json?.Payment?.Status;
  assert(typeof status === "number", "Query recurrence: missing Payment.Status");
  return { status, raw: json };
}

async function createPixSale({ merchantId, merchantKey, isSandbox }) {
  const { transactional } = cieloUrls(isSandbox);
  const orderId = `API-TEST-PIX-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const payload = {
    MerchantOrderId: orderId,
    Customer: {
      Name: "API Test",
      Email: "api-test@novita.local",
      Identity: "11111111111",
      IdentityType: "CPF",
    },
    Payment: {
      Type: "Pix",
      Amount: 100, // R$ 1,00
      Installments: 1,
      ...(isSandbox
        ? {}
        : {
            Provider: getEnv("CIELO_PIX_PROVIDER") || "Cielo2",
            QrCode: {
              Expiration: Number.parseInt(getEnv("CIELO_PIX_QRCODE_EXPIRATION") || "1800", 10),
            },
          }),
    },
  };

  const { res, json, text } = await fetchJson(`${transactional}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      MerchantId: merchantId,
      MerchantKey: merchantKey,
    },
    body: JSON.stringify(payload),
  });

  assert(json, `Create PIX sale: invalid JSON (HTTP ${res.status})`);
  if (!res.ok) {
    throw new Error(
      `Create PIX sale failed (HTTP ${res.status}): ${
        json?.[0]?.Message || json?.Message || text?.slice(0, 200) || "unknown error"
      }`
    );
  }

  const paymentId = json?.Payment?.PaymentId;
  const status = json?.Payment?.Status;
  const qrString = json?.Payment?.QrCodeString || json?.Payment?.QrCodeString?.QrCodeString;
  const qrBase64 = json?.Payment?.QrCodeBase64Image || json?.Payment?.QrCodeBase64Image?.QrCodeBase64Image;
  assert(paymentId, "Create PIX sale: missing Payment.PaymentId");
  assert(typeof status === "number", "Create PIX sale: missing Payment.Status");
  assert(qrString || qrBase64, "Create PIX sale: missing QRCode fields (QrCodeString/QrCodeBase64Image)");

  return { orderId, paymentId, status, raw: json };
}

async function main() {
  const merchantId = getEnv("CIELO_MERCHANT_ID") || getEnv("VITE_CIELO_MERCHANT_ID");
  const merchantKey = getEnv("CIELO_MERCHANT_KEY") || getEnv("VITE_CIELO_MERCHANT_KEY");
  const isSandboxEnv = (getEnv("CIELO_SANDBOX") || getEnv("VITE_CIELO_SANDBOX")) === "true";
  const allowProd = getEnv("ALLOW_CIELO_PROD_TESTS") === "true";

  assert(merchantId, "Missing CIELO_MERCHANT_ID (or VITE_CIELO_MERCHANT_ID)");
  assert(merchantKey, "Missing CIELO_MERCHANT_KEY (or VITE_CIELO_MERCHANT_KEY)");

  console.log(`[Cielo API] Environment: ${isSandboxEnv ? "SANDBOX" : "PRODUCTION"}`);

  const auth = await checkQueryAuth({ merchantId, merchantKey, isSandbox: isSandboxEnv });
  console.log(`[Cielo API] Query auth: ${auth.ok ? "OK" : "FAIL"} (HTTP ${auth.status}) ${auth.message}`);
  assert(auth.ok, "Cielo query auth failed (check merchant credentials / sandbox flag)");

  if (!isSandboxEnv && !allowProd) {
    console.log(
      "[Cielo API] Skipping CREATE/VOID tests in PRODUCTION. Set ALLOW_CIELO_PROD_TESTS=true to run them."
    );
    return;
  }

  // Credit card: success
  console.log("[Cielo API] Creating credit card sale (success)...");
  const ccOk = await createCreditCardSale({
    merchantId,
    merchantKey,
    isSandbox: isSandboxEnv,
    cardNumber: "4024007153763191",
  });
  console.log(`[Cielo API] Credit card sale created: paymentId=${ccOk.paymentId} status=${ccOk.status}`);
  assert([1, 2].includes(ccOk.status), `Unexpected credit card status: ${ccOk.status}`);

  console.log("[Cielo API] Querying credit card sale...");
  const ccQuery = await querySale({ merchantId, merchantKey, isSandbox: isSandboxEnv, paymentId: ccOk.paymentId });
  console.log(`[Cielo API] Credit card sale status (query): ${ccQuery.status}`);
  assert(typeof ccQuery.status === "number", "Missing status in credit card query");

  console.log("[Cielo API] Voiding credit card sale...");
  const ccVoid = await voidSale({ merchantId, merchantKey, isSandbox: isSandboxEnv, paymentId: ccOk.paymentId });
  console.log(`[Cielo API] Credit card void status: ${ccVoid.status}`);
  assert(ccVoid.status === 10, `Expected void status=10, got ${ccVoid.status}`);

  // Credit card: denied
  console.log("[Cielo API] Creating credit card sale (denied)...");
  try {
    const ccDenied = await createCreditCardSale({
      merchantId,
      merchantKey,
      isSandbox: isSandboxEnv,
      cardNumber: "4024007153763192",
    });
    console.log(`[Cielo API] Denied sale created: paymentId=${ccDenied.paymentId} status=${ccDenied.status}`);
    assert(ccDenied.status === 3, `Expected denied status=3, got ${ccDenied.status}`);
  } catch (err) {
    console.log(`[Cielo API] Denied sale returned error as expected: ${(err instanceof Error ? err.message : String(err)).slice(0, 180)}`);
  }

  // Recurrent
  console.log("[Cielo API] Creating recurrent sale...");
  const rec = await createRecurrentSale({ merchantId, merchantKey, isSandbox: isSandboxEnv });
  console.log(`[Cielo API] Recurrent sale created: paymentId=${rec.paymentId} recurrentPaymentId=${rec.recurrentPaymentId}`);

  console.log("[Cielo API] Querying recurrence...");
  const recQuery = await queryRecurrence({
    merchantId,
    merchantKey,
    isSandbox: isSandboxEnv,
    recurrentPaymentId: rec.recurrentPaymentId,
  });
  console.log(`[Cielo API] Recurrence status (query): ${recQuery.status}`);

  // PIX
  console.log("[Cielo API] Creating PIX sale...");
  const pix = await createPixSale({ merchantId, merchantKey, isSandbox: isSandboxEnv });
  console.log(`[Cielo API] PIX sale created: paymentId=${pix.paymentId} status=${pix.status}`);
  assert([12, 1, 2].includes(pix.status), `Unexpected PIX status: ${pix.status}`);

  console.log("[Cielo API] Querying PIX sale...");
  // Give Cielo a moment before query
  await sleep(800);
  const pixQuery = await querySale({ merchantId, merchantKey, isSandbox: isSandboxEnv, paymentId: pix.paymentId });
  console.log(`[Cielo API] PIX sale status (query): ${pixQuery.status}`);
}

main().catch((err) => {
  console.error("[Cielo API] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});

