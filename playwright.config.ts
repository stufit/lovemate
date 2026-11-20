import { defineConfig } from "@playwright/test";
import "./apps/api/src/config";
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
  throw new Error(
    "E2E requires a dedicated TEST_DATABASE_URL ending in _test.",
  );
const localEnv = {
  NEXT_DIST_DIR: ".next-e2e",
  DATABASE_URL: databaseUrl,
  WEB_BASE_URL: "http://127.0.0.1:3100",
  PORT: "4100",
  API_BASE_URL: "http://127.0.0.1:4100",
};
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { channel: "chrome" },
  },
  webServer: [
    {
      command: "pnpm --filter @woorisai/api dev",
      env: localEnv,
      url: "http://127.0.0.1:4100/api/v1/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "pnpm --filter @woorisai/web dev --port 3100",
      env: localEnv,
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
