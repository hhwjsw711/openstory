import { defineConfig, devices } from 'playwright/test';

/**
 * Playwright E2E Test Configuration
 * Uses separate test.db for isolation, mocks AI/workflow responses
 */
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: './e2e/tests',
  outputDir: './e2e/results',

  // Run tests in parallel now that we share auth state
  // Note: Using 1 worker locally to avoid SQLite locking issues
  // CI uses WAL mode + multiple workers
  fullyParallel: true,
  workers: 4,

  // Fail fast on CI
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  // CI: github for annotations + html for uploadable report
  // Local: html only
  reporter: process.env.CI ? [['github'], ['html']] : 'html',

  // Global test timeout
  timeout: 60_000,

  // Shared settings for all projects
  use: {
    baseURL: 'http://localhost:3001',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // Configure projects
  projects: [
    // Setup project - authenticates once, saves state
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Auth tests - run without stored state to test actual login flow
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // All other tests - use stored auth state
    {
      name: 'chromium',
      testIgnore: /auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Run dev server on port 3001 with test.db
  // server.warmup in vite.config.ts pre-compiles SSR routes to avoid race conditions
  webServer: {
    command: 'E2E_TEST=true PORT=3001 DATABASE_URL=file:test.db bun dev:e2e',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
