import { defineConfig } from "@playwright/test";

const baseURL =
  process.env.BASE_URL ||
  "http://localhost:5173";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 1,
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
  },
});
