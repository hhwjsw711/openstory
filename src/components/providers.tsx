import { Toaster } from '@/components/ui/sonner';
import { aiDevtoolsPlugin } from '@tanstack/react-ai-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { RealtimeProvider } from '@upstash/realtime/client';

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

      <Toaster />
    </QueryClientProvider>
  );
}
