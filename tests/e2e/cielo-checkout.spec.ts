import { test, expect, type Page } from "@playwright/test";

// =============================================
// Helpers
// =============================================

const patientEmail = process.env.E2E_PATIENT_EMAIL || "paciente01@novita.com";
const patientPassword = process.env.E2E_PATIENT_PASSWORD || "Paciente#123";

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Login" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: /Entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function ensureMedicationPaymentStep(page: Page) {
  // Medication checkout is a 2-step flow: Address -> Payment.
  // Profile address loading is async and can auto-advance to payment, so we wait for either state.
  const cardNumber = page.getByPlaceholder(/0000 0000 0000 0000/i).first();
  const continueBtn = page.getByRole("button", { name: /Continuar para Pagamento/i });
  const addBtn = page.getByRole("button", { name: /Adicionar endereço/i });
  const changeBtn = page.getByRole("button", { name: /^Alterar$/i });
  const cepInput = page.getByLabel(/^CEP$/i);
  const saveBtn = page.getByRole("button", { name: /Salvar e Confirmar/i });

  await expect(cardNumber.or(continueBtn).or(addBtn)).toBeVisible({ timeout: 15000 });

  // Already on payment step.
  if (await cardNumber.isVisible({ timeout: 500 }).catch(() => false)) return;

  // Address exists: continue to payment.
  if (await continueBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await continueBtn.click();
    await expect(cardNumber).toBeVisible({ timeout: 15000 });
    return;
  }

  // Enter edit mode (new address or edit existing).
  if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await addBtn.click();
  } else if (await changeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await changeBtn.click();
  }

  // Auto-advance can happen while we interact; bail out if payment is already visible.
  if (await cardNumber.isVisible({ timeout: 1000 }).catch(() => false)) return;

  // Fill required fields (keep it deterministic; no CEP lookup).
  await expect(cepInput).toBeVisible({ timeout: 15000 });
  await cepInput.fill("01001000");
  await page.getByLabel(/Rua\/Avenida/i).fill("Rua Teste");
  await page.getByLabel(/^Número$/i).fill("123");
  await page.getByLabel(/^Bairro$/i).fill("Centro");
  await page.getByLabel(/^Cidade$/i).fill("Sao Paulo");
  await page.getByLabel(/^Estado$/i).fill("SP");

  await expect(saveBtn).toBeVisible({ timeout: 15000 });
  await saveBtn.click();
  await expect(cardNumber).toBeVisible({ timeout: 15000 });
}

async function openSubscriptionCheckout(page: Page, opts?: { requireYearly?: boolean }) {
  // Some accounts may already have a plan active; the page blocks re-buying the same plan type.
  // We try a few types until one loads the checkout instead of redirecting back to /planos.
  const planTypes = [
    "bronze",
    "prata",
    "ouro",
    "diamante",
    "bronze-coletivo",
    "prata-coletivo",
    "ouro-coletivo",
    "diamante-coletivo",
  ];

  for (const type of planTypes) {
    await page.goto(`/checkout/subscription?plan=${type}`);
    await page.waitForLoadState("networkidle");

    if (/\/planos/.test(page.url())) continue;

    const title = page.getByRole("heading", { name: /Assinar Plano/i });
    if (!(await title.count())) continue;

    if (opts?.requireYearly) {
      const yearly = page.locator('label[for="yearly"]');
      if (!(await yearly.isVisible().catch(() => false))) continue;
    }

    return;
  }

  throw new Error("Nenhum plano disponível para checkout (todas as tentativas redirecionaram para /planos)");
}

function seedCart(page: Page) {
  return page.addInitScript(() => {
    localStorage.setItem(
      "cart",
      JSON.stringify([
        {
          id: "med-e2e-cielo",
          name: "Paracetamol (Teste Cielo)",
          dosage: "750mg",
          frequency: "1x ao dia",
          duration: "5 dias",
          price: 12.5,
          inStock: true,
          prescriptionId: "rx-e2e-cielo",
          quantity: 2,
        },
      ])
    );
  });
}

// Test card that ends in 1 → authorized in mock
const TEST_CARD = {
  number: "4024 0071 5376 3191",
  holder: "TESTE CIELO",
  expiration: "12/2030",
  cvv: "123",
};

// =============================================
// 1. Medication Checkout — Credit Card
// =============================================

test.describe("Medication Checkout", () => {
  test.describe.configure({ timeout: 120_000 });

  test("Credit card payment completes successfully", async ({ page }) => {
    await seedCart(page);
    await login(page, patientEmail, patientPassword);
    await page.goto("/checkout/medication");
    await page.waitForLoadState("networkidle");

    // Should see checkout page
    await expect(
      page.getByRole("heading", { name: /Finalizar Compra/i })
    ).toBeVisible({ timeout: 15000 });

    await ensureMedicationPaymentStep(page);

    const cardNumberField = page.getByPlaceholder(/0000 0000 0000 0000/i).first();
    await expect(cardNumberField).toBeVisible({ timeout: 10000 });

    // Fill credit card form
    await cardNumberField.fill(TEST_CARD.number);
    await page.getByPlaceholder(/impresso/i).fill(TEST_CARD.holder);
    await page.getByPlaceholder(/MM\/AAAA/i).fill(TEST_CARD.expiration);
    await page.getByPlaceholder(/^123$/).fill(TEST_CARD.cvv);

    // Submit payment
    const submitBtn = page.getByRole("button", { name: /Pagar|Finalizar/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Should show success state
    await expect(page.getByRole("heading", { name: /Pagamento Confirmado/i })).toBeVisible({ timeout: 20000 });
  });

  test("PIX payment flow generates QR code and confirms", async ({ page }) => {
    await seedCart(page);
    await login(page, patientEmail, patientPassword);
    await page.goto("/checkout/medication");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /Finalizar Compra/i })
    ).toBeVisible({ timeout: 15000 });

    await ensureMedicationPaymentStep(page);

    // Select PIX payment method
    await page.getByRole("button", { name: /^PIX$/i }).click();

    // Click generate QR Code
    const generateBtn = page.getByRole("button", { name: /Gerar QR Code/i });
    await expect(generateBtn).toBeVisible({ timeout: 5000 });
    await generateBtn.click();

    // Should show QR code and waiting state
    await expect(page.getByRole("img", { name: /QR Code PIX/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Aguardando confirmacao/i)).toBeVisible({ timeout: 15000 });

    // Simulate payment confirmation
    const simulateBtn = page.getByRole("button", {
      name: /Simular confirma/i,
    });
    await expect(simulateBtn).toBeVisible({ timeout: 5000 });
    await simulateBtn.click();

    // Should confirm (either the PIX component success state or the overall checkout success screen).
    const pixConfirmed = page.getByRole("heading", { name: /PIX Confirmado/i });
    const paymentConfirmed = page.getByRole("heading", { name: /Pagamento Confirmado/i });
    await expect(pixConfirmed.or(paymentConfirmed)).toBeVisible({ timeout: 20000 });
  });
});

// =============================================
// 2. Subscription Checkout — Credit Card
// =============================================

test.describe("Subscription Checkout", () => {
  test.describe.configure({ timeout: 120_000 });

  test("Monthly credit card subscription", async ({ page }) => {
    await login(page, patientEmail, patientPassword);
    await openSubscriptionCheckout(page);

    // Should see checkout page
    await expect(page.getByRole("heading", { name: /Assinar Plano/i })).toBeVisible({
      timeout: 15000,
    });

    // Should default to monthly billing
    const monthlyOption = page.getByText(/Mensal/i).first();
    await expect(monthlyOption).toBeVisible();

    // Fill credit card
    const cardNumberField = page.getByPlaceholder(/0000 0000 0000 0000/i).first();
    await expect(cardNumberField).toBeVisible({ timeout: 10000 });
    await cardNumberField.fill(TEST_CARD.number);
    await page.getByPlaceholder(/impresso/i).fill(TEST_CARD.holder);
    await page.getByPlaceholder(/MM\/AAAA/i).fill(TEST_CARD.expiration);
    await page.getByPlaceholder(/^123$/).fill(TEST_CARD.cvv);

    // Submit
    const submitBtn = page.getByRole("button", { name: /Assinar/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Some flows redirect to /dashboard immediately after success.
    await Promise.any([
      page.waitForURL(/\/dashboard/, { timeout: 20000 }),
      page.getByRole("heading", { name: /Assinatura Ativada/i }).waitFor({ state: "visible", timeout: 20000 }),
    ]);
  });

  test("Yearly credit card subscription", async ({ page }) => {
    await login(page, patientEmail, patientPassword);
    await openSubscriptionCheckout(page, { requireYearly: true });

    // Select yearly billing
    await page.locator('label[for="yearly"]').click();

    // Credit card form should still be shown
    const cardNumberField = page.getByPlaceholder(/0000 0000 0000 0000/i).first();
    await expect(cardNumberField).toBeVisible({ timeout: 10000 });
    await cardNumberField.fill(TEST_CARD.number);
    await page.getByPlaceholder(/impresso/i).fill(TEST_CARD.holder);
    await page.getByPlaceholder(/MM\/AAAA/i).fill(TEST_CARD.expiration);
    await page.getByPlaceholder(/^123$/).fill(TEST_CARD.cvv);

    const submitBtn = page.getByRole("button", { name: /Assinar/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await Promise.any([
      page.waitForURL(/\/dashboard/, { timeout: 20000 }),
      page.getByRole("heading", { name: /Assinatura Ativada/i }).waitFor({ state: "visible", timeout: 20000 }),
    ]);
  });
});
