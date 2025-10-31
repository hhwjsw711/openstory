import type { Decorator, Preview } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { withThemeByClassName } from '@storybook/addon-themes';
import React from 'react';
import '../src/app/global.css';

// Initialize MSW for API mocking
if (typeof window !== 'undefined') {
  import('../src/lib/mocks').then(({ worker }) => {
    worker.start({
      onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
    });
  });
}

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
  },
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
