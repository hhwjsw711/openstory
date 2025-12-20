import { defineConfig, devices } from 'playwright/test';

/**
 * Playwright E2E Test Configuration
 * Uses separate test.db for isolation, mocks AI/workflow responses
 */
export default defineConfig({
  testDir: './e2e/tests',
  outputDir: './e2e/results',

  // Run tests sequentially for now (simpler state management)
  fullyParallel: false,
  workers: 1,

  // Fail fast on CI
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: process.env.CI ? 'github' : 'html',

  // Global test timeout
  timeout: 30_000,

  // Shared settings for all projects
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run dev server before tests (use doppler for secrets, override DB)
  webServer: {
    command:
      'doppler run --command "DATABASE_URL=file:test.db BETTER_AUTH_SECRET=e2e-test-secret-min-32-chars-long bun dev:e2e"',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
