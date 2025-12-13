import { withThemeByClassName } from '@storybook/addon-themes';
import type { Decorator, Preview } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RealtimeProvider } from '@upstash/realtime/client';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { handlers } from '../src/lib/mocks/handlers';

import '../src/styles/global.css';

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

const withProviders: Decorator = (Story) => (
  <QueryClientProvider client={queryClient}>
    <RealtimeProvider api={{ url: '/api/realtime' }} maxReconnectAttempts={1}>
      <Story />
    </RealtimeProvider>
  </QueryClientProvider>
);

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

    // Adds default padding around components
    layout: 'padded',

    viewport: {
      defaultViewport: 'responsive', // Default viewport size
    },

    // Configure MSW handlers globally for all stories
    msw: {
      handlers,
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
  loaders: [mswLoader],
  decorators: [
    withProviders,
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
