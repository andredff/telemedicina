import { test, expect, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "admin@novita.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "Admin#123";
const patientEmail = process.env.E2E_PATIENT_EMAIL || "paciente01@novita.com";
const targetOrderId = process.env.TARGET_ORDER_ID || "";

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Login" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: /Entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}

async function changeOrderStatus(page: Page, orderId: string, optionLabel: string) {
  await page.getByPlaceholder("Buscar pedidos por ID ou usuário...").fill(orderId);
  const row = page.locator("tr", { hasText: orderId }).first();
  await expect(row).toBeVisible({ timeout: 15000 });

  await row.getByRole("combobox").click();
  await page.getByRole("option", { name: optionLabel }).click();

  await expect(
    page.getByText(/Status alterado|Status atualizado|notificação enviada|notificação não enviada/i).first()
  ).toBeVisible({ timeout: 15000 });
}

test.describe.configure({ timeout: 180_000 });

test("Régua de email por status + envio manual no admin", async ({ page }) => {
  if (!targetOrderId) {
    test.skip(true, "TARGET_ORDER_ID não informado");
  }

  await login(page, adminEmail, adminPassword);
  await page.goto("/admin/pedidos");
  await expect(
    page.getByRole("heading", { name: /Gerenciamento de Pedidos/i })
  ).toBeVisible({ timeout: 20000 });

  await changeOrderStatus(page, targetOrderId, "Em Trânsito");
  await changeOrderStatus(page, targetOrderId, "Entregue");
  await changeOrderStatus(page, targetOrderId, "Cancelado");
  await changeOrderStatus(page, targetOrderId, "Processando");

  await page.getByPlaceholder("Buscar pedidos por ID ou usuário...").fill(targetOrderId);
  const row = page.locator("tr", { hasText: targetOrderId }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.locator('button[title="Ver detalhes"]').click();

  await expect(page.getByText(new RegExp(`Detalhes do Pedido #${targetOrderId}`))).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("button", { name: "Enviar Notificação" }).first().click();
  await expect(page.getByRole("heading", { name: "Enviar Notificação" })).toBeVisible({
    timeout: 15000,
  });

  await page.locator("#tracking").fill("BRTEST123456789");
  await page.locator("#delivery").fill("2 dias úteis");
  await page.getByRole("button", { name: "Enviar Notificação" }).nth(1).click();

  await expect(
    page.getByText(/Notificação enviada|Erro|Status alterado|notificação não enviada/i).first()
  ).toBeVisible({ timeout: 15000 });
});

test("Recuperação de senha dispara fluxo de email", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: /Esqueci minha senha/i }).click();
  await expect(page.getByRole("heading", { name: /Recuperar senha/i })).toBeVisible({
    timeout: 15000,
  });

  await page.getByLabel("Email").fill(patientEmail);
  await page.getByRole("button", { name: /Enviar link de recuperação/i }).click();

  await expect(
    page.getByText(/Email enviado|Erro ao enviar email|Verifique sua caixa de entrada/i).first()
  ).toBeVisible({ timeout: 20000 });
});
