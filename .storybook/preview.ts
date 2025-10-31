import { withThemeByClassName } from '@storybook/addon-themes';
import type { Decorator, Preview } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { handlers } from '../src/lib/mocks/handlers';

import React from 'react';
import '../src/app/global.css';

/*
 * Initializes MSW with our API handlers
 * See https://github.com/mswjs/msw-storybook-addon#configuring-msw
 * to learn how to customize it
 */
initialize({
  onUnhandledRequest: 'bypass',
});

// Create a client for Storybook
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const withQueryClient: Decorator = (StoryFn) => {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(StoryFn)
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
      // Configure Next.js Image component for Storybook
      image: {
        unoptimized: true, // Disable image optimization in Storybook
      },
    },
    backgrounds: {
      disable: true, // Disable default backgrounds addon since we're using theme colors
    },
    layout: 'padded', // Adds default padding around components
    viewport: {
      defaultViewport: 'responsive', // Default viewport size
    },
    // Configure MSW handlers globally for all stories
    msw: {
      handlers,
    },
  },
  loaders: [mswLoader],
  decorators: [
    withQueryClient,
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'dark',
    }),
  ],
};

export default preview;
