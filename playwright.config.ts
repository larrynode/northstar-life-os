import { defineConfig, devices } from "@playwright/test";

const testDataDir = `/private/tmp/northstar-life-os-e2e-${process.pid}`;
const testPort = Number(process.env.NORTHSTAR_E2E_PORT ?? 18_767);
const testBaseUrl = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: testBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `NORTHSTAR_DATA_DIR=${testDataDir} pnpm exec next dev --webpack -H 127.0.0.1 -p ${testPort}`,
    url: testBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
});
