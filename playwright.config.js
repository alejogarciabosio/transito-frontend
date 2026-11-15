import { defineConfig, devices } from "@playwright/test";

// E2E sin backend real: el front se sirve compilado (vite preview) y la API se simula con page.route.
const PORT = 4173;

export default defineConfig({
  testDir: "./e2e/tests",
  testMatch: "**/*.e2e.js",
  fullyParallel: true,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
