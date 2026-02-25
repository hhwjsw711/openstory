import { Toaster } from '@/components/ui/sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { RealtimeProvider } from '@upstash/realtime/client';
import { lazy, type FC } from 'react';

// Wrap the entire lazy() in import.meta.env.DEV so Vite dead-code-eliminates
// the dynamic imports before rollup tries to resolve them. This prevents
// @tanstack/ai-devtools-core's Solid.js transitive imports from breaking the build.
const TanStackDevtoolsLazy: FC = import.meta.env.DEV
  ? lazy(async () => {
      const [
        { TanStackDevtools },
        { ReactQueryDevtoolsPanel },
        { TanStackRouterDevtoolsPanel },
        { aiDevtoolsPlugin },
      ] = await Promise.all([
        import('@tanstack/react-devtools'),
        import('@tanstack/react-query-devtools'),
        import('@tanstack/react-router-devtools'),
        import('@tanstack/react-ai-devtools'),
      ]);

      return {
        default: () => (
          <TanStackDevtools
            plugins={[
              {
                name: 'TanStack Query',
                render: <ReactQueryDevtoolsPanel />,
                defaultOpen: true,
              },
              {
                name: 'TanStack Router',
                render: <TanStackRouterDevtoolsPanel />,
                defaultOpen: false,
              },
              aiDevtoolsPlugin(),
            ]}
          />
        ),
      };
    })
  : () => null;

type ProvidersProps = {
  children: React.ReactNode;
  queryClient: QueryClient;
};

export function Providers({ children, queryClient }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider
        api={{ url: '/api/realtime' }}
        maxReconnectAttempts={10}
      >
        {children}
      </RealtimeProvider>
      <TanStackDevtoolsLazy />
      <Toaster />
    </QueryClientProvider>
  );
}
