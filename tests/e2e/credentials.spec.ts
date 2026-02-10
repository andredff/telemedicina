import { test, expect, type Page } from "@playwright/test";

type Cred = { label: string; email: string; password: string };

const creds: Cred[] = [
  { label: "admin", email: "admin@novita.com", password: "Admin#123" },
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

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Login" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: /Entrar/i }).click();
}

test("Credenciais de acesso e teste (todos)", async ({ browser }) => {
  // This test iterates through many accounts and can take a few minutes on a remote baseURL.
  test.setTimeout(10 * 60_000);

  for (const cred of creds) {
    await test.step(`${cred.label}`, async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, cred.email, cred.password);
      await expect(page).toHaveURL(/\/dashboard/);
      await context.close();
    });
  }
});
