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
  // If the address is complete in profile, the UI auto-advances to payment.
  const cardNumber = page.getByPlaceholder(/0000 0000 0000 0000/i).first();
  if (await cardNumber.isVisible({ timeout: 2000 }).catch(() => false)) return;

  // If an address exists, click "Continuar para Pagamento".
  const continueBtn = page.getByRole("button", { name: /Continuar para Pagamento/i });
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueBtn.click();
    await expect(cardNumber).toBeVisible({ timeout: 15000 });
    return;
  }

  // Otherwise, add a minimal address and confirm.
  const addBtn = page.getByRole("button", { name: /Adicionar endereço/i });
  if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addBtn.click();
  } else {
    // Fallback: open edit mode if the user already has a partial address.
    const changeBtn = page.getByRole("button", { name: /^Alterar$/i });
    if (await changeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await changeBtn.click();
    }
  }

  // Fill required fields (keep it deterministic; no CEP lookup).
  await expect(page.getByLabel(/^CEP$/i)).toBeVisible({ timeout: 15000 });
  await page.getByLabel(/^CEP$/i).fill("01001000");
  await page.getByLabel(/Rua\/Avenida/i).fill("Rua Teste");
  await page.getByLabel(/^Número$/i).fill("123");
  await page.getByLabel(/^Bairro$/i).fill("Centro");
  await page.getByLabel(/^Cidade$/i).fill("Sao Paulo");
  await page.getByLabel(/^Estado$/i).fill("SP");

  await page.getByRole("button", { name: /Salvar e Confirmar/i }).click();
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

    // Should show success state or redirect
    await expect(
      page.getByText(/sucesso|confirmado|aprovado|Pedido/i)
    ).toBeVisible({ timeout: 20000 });
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

    // Should confirm
    await expect(page.getByRole("heading", { name: /PIX Confirmado/i })).toBeVisible({ timeout: 15000 });
  });
});

// =============================================
// 2. Subscription Checkout — Credit Card
// =============================================

test.describe("Subscription Checkout", () => {
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

    // Should show success
    await expect(
      page.getByText(/Ativada|sucesso|Bem-vindo/i)
    ).toBeVisible({ timeout: 20000 });
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

    await expect(
      page.getByText(/Ativada|sucesso|Bem-vindo/i)
    ).toBeVisible({ timeout: 20000 });
  });
});
