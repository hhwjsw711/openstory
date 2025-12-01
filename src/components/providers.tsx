'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RealtimeProvider } from '@upstash/realtime/client';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            // structuralSharing: true (default) - Preserves unchanged object references
            // across query updates, which is critical for React.memo optimization in
            // scene list components. This prevents unnecessary re-renders when polling.
          },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider
        api={{ url: '/api/realtime' }}
        maxReconnectAttempts={10}
      >
        {children}
      </RealtimeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
