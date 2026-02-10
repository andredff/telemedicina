import { test, expect, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "admin@novita.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "Admin#123";
const patientEmail = process.env.E2E_PATIENT_EMAIL || "paciente01@novita.com";
const patientPassword = process.env.E2E_PATIENT_PASSWORD || "Paciente#123";

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Login" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: /Entrar/i }).click();
}

test("Home, Planos, Como Funciona carregam", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Novità/i);

  await page.goto("/planos");
  await expect(page.getByRole("heading", { name: /Escolha o plano ideal/i })).toBeVisible();

  await page.goto("/como-funciona");
  await expect(page.getByRole("heading", { name: /Como funciona/i })).toBeVisible();
});

test("Login paciente e acesso a Dashboard/Pedidos", async ({ page }) => {
  await login(page, patientEmail, patientPassword);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/Olá,/)).toBeVisible();

  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: /Meus Pedidos/i })).toBeVisible();
});

test("Login admin e acesso a Admin Orders/Reports/Users", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/admin/pedidos");
  await expect(
    page.getByRole("heading", { name: /Gerenciamento de Pedidos/i })
  ).toBeVisible();

  await page.goto("/admin/relatorios");
  await expect(page.getByRole("heading", { name: /Relat/i })).toBeVisible();

  await page.goto("/admin/usuarios");
  await expect(
    page.getByRole("heading", { name: /Gerenciamento de Usuários/i })
  ).toBeVisible();
});

test("Profile settings", async ({ page }) => {
  await login(page, patientEmail, patientPassword);
  await page.waitForURL(/\/dashboard/);
  await page.goto("/perfil");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /Meu Perfil/i })).toBeVisible({ timeout: 15000 });
});

test("Fluxo de compra básico (sem pagamento real)", async ({ page }) => {
  // Seed minimal cart to avoid redirect to /cart.
  await page.addInitScript(() => {
    localStorage.setItem(
      "cart",
      JSON.stringify([
        {
          id: "med-e2e-1",
          name: "Dipirona (Teste)",
          dosage: "500mg",
          frequency: "1x ao dia",
          duration: "7 dias",
          price: 9.9,
          inStock: true,
          prescriptionId: "rx-e2e-1",
          quantity: 1,
        },
      ])
    );
  });

  await login(page, patientEmail, patientPassword);
  await page.waitForURL(/\/dashboard/);
  await page.goto("/checkout/medication");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /Finalizar Compra/i })).toBeVisible({ timeout: 15000 });
});
