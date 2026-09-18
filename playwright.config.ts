import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.FLATMATE_TEST_DIR ??= mkdtempSync(join(tmpdir(), "flatmate-e2e-"));
export default defineConfig({
  testDir: "./tests/e2e",
  globalTeardown: "./tests/e2e/teardown.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1050 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 375, height: 812 },
        defaultBrowserType: "chromium",
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start -- --port 3002",
    env: {
      APP_URL: "http://localhost:3002",
      DEMO_MODE: "true",
      DEMO_DATA_DIR: process.env.FLATMATE_TEST_DIR,
      NEXT_DIST_DIR: ".next-e2e",
    },
    url: "http://localhost:3002/login",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
