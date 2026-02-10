import { test, expect, type Page } from "@playwright/test";

type Cred = { label: string; email: string; password: string };

const adminEmail = process.env.E2E_ADMIN_EMAIL || "admin@novita.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "Admin#123";
const patientEmail = process.env.E2E_PATIENT_EMAIL || "paciente01@novita.com";
const patientPassword = process.env.E2E_PATIENT_PASSWORD || "Paciente#123";

// Default = validate only the baseline credentials from PLANO_TESTES_PRODUCAO.md.
// Set E2E_FULL_CREDENTIALS=1 to validate all seeded test accounts (if they exist in this environment).
const runFull = process.env.E2E_FULL_CREDENTIALS === "1";

const fullCreds: Cred[] = [
  { label: "admin", email: adminEmail, password: adminPassword },
  { label: "doctor1", email: "doctor1@novita.com", password: "Doctor#123" },
  { label: "doctor2", email: "doctor2@novita.com", password: "Doctor#123" },
  { label: "support1", email: "support1@novita.com", password: "Support#123" },
  { label: "support2", email: "support2@novita.com", password: "Support#123" },
  ...Array.from({ length: 20 }, (_, i) => {
    const id = String(i + 1).padStart(2, "0");
    return {
      label: `paciente${id}`,
      email: `paciente${id}@novita.com`,
      password: "Paciente#123",
    };
  }),
];

const creds: Cred[] = runFull
  ? fullCreds
  : [
      { label: "admin", email: adminEmail, password: adminPassword },
      { label: "paciente01", email: patientEmail, password: patientPassword },
    ];

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Login" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: /Entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}

test("Credenciais de acesso e teste (todos)", async ({ browser }) => {
  // This test iterates through many accounts and can take a few minutes on a remote baseURL.
  test.setTimeout(10 * 60_000);

  for (const cred of creds) {
    await test.step(`${cred.label}`, async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, cred.email, cred.password);
      await context.close();
    });
  }
});
