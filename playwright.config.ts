import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3456",
    ...devices["Desktop Chrome"],
    channel: "chrome",
  },
  webServer: {
    command: "bash scripts/e2e-server.sh",
    url: "http://localhost:3456",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
