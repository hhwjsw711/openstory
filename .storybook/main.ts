import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
  viteFinal(config) {
    config.resolve = config.resolve ?? {};

    // Mock TanStack Start server functions so they become no-ops in Storybook.
    // Without this, createServerFn calls try to fetch /_serverFn/ which doesn't exist.
    // Use regex so only exact imports are matched (not subpath like /client).
    const mockPath = path.resolve(
      __dirname,
      '../src/lib/mocks/tanstack-start.ts'
    );
    const existingAliases = Array.isArray(config.resolve.alias)
      ? config.resolve.alias
      : Object.entries(config.resolve.alias ?? {}).map(
          ([find, replacement]) => ({ find, replacement })
        );
    config.resolve.alias = [
      ...existingAliases,
      { find: /^@tanstack\/react-start$/, replacement: mockPath },
      { find: /^@tanstack\/react-start\/server$/, replacement: mockPath },
    ];

    return config;
  },
};
export default config;
