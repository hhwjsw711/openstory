import type { KnipConfig } from 'knip';

export default {
  entry: [
    'src/router.tsx',
    'src/routes/**/*.{ts,tsx}',
    'src/functions/**/*.ts',
    'scripts/**/*.ts',
    '.storybook/**/*.{ts,tsx}',
    // Conditional imports (package.json "imports" field)
    'src/lib/db/client-http.ts',
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
    '**/*.gen.ts',
  ],
  ignoreDependencies: [
    // Tailwind plugins
    'tw-animate-css',
    // PostCSS (used by Vite internally)
    'postcss',
    // Tailwind (used via @tailwindcss/vite)
    'tailwindcss',
    // Testing library (used in test setup)
    '@testing-library/jest-dom',
    '@testing-library/react',
    '@testing-library/user-event',

    // shadcn CLI tool
    'shadcn',
    // Cloudflare Workers runtime module (not an npm package)
    'cloudflare',
  ],
  ignoreBinaries: [
    // CLI tools used in package.json scripts
    'stripe',
    'open',
    'doppler',
  ],
} satisfies KnipConfig;
