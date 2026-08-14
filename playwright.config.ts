import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: ".playwright-output",
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://vance-dotson.anadias-dev.workers.dev",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
