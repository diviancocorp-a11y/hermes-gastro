import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for La Nona Pato.
 *
 * Usage:
 *   npx playwright test              → run all E2E tests
 *   npx playwright test --ui         → interactive UI mode
 *   npx playwright test --project=mobile → only mobile tests
 *
 * Environment variables:
 *   BASE_URL    → defaults to http://localhost:5173
 *   CI          → set in GitHub Actions (disables retries, uses 1 worker)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'] },
    },
  ],

  // Start dev server before running tests (only locally)
  ...(process.env.CI ? {} : {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  }),
});
