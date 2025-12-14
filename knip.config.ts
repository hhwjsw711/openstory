import type { KnipConfig } from 'knip';

export default {
  entry: [
    'src/router.tsx',
    'src/routes/**/*.{ts,tsx}',
    'src/functions/**/*.ts',
    'scripts/**/*.ts',
    '.storybook/**/*.{ts,tsx}',
    // Test setup
    'src/test/setup.ts',
    // Conditional imports (package.json "imports" field)
    'src/lib/db/client-local.ts',
    'src/lib/db/client-http.ts',
    'src/lib/env/cloudflare.ts',
    // MSW mocks
    'src/lib/mocks/browser.ts',
    'src/lib/mocks/server.ts',
    // LetzAI config (codegen)
    'src/lib/letzai/letzai-config.ts',
  ],
  project: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
  ignore: [
    'src/routeTree.gen.ts',
    '**/*.stories.tsx',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.gen.ts',
    'drizzle.config.ts',
    'drizzle.config.*.ts',
  ],
  ignoreDependencies: [
    // Tailwind plugins
    'tw-animate-css',
    // PostCSS (used by Vite internally)
    'postcss',
    // Tailwind (used via @tailwindcss/vite)
    'tailwindcss',
    // Lefthook (git hooks, not imported)
    'lefthook',
    // Testing library (used in test setup)
    '@testing-library/jest-dom',
    '@testing-library/react',
    '@testing-library/user-event',
    // Vitest coverage (CLI flag)
    '@vitest/coverage-v8',
    // shadcn CLI tool
    'shadcn',
  ],
  // Disable drizzle plugin - config requires env vars
  drizzle: false,
  // Disable lefthook plugin - fails in git worktrees
  lefthook: false,
} satisfies KnipConfig;
