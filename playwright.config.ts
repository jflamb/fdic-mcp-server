import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: {
    command: "tsx tests/e2e/test-server.ts",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
