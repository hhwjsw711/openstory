import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from '@/components/ui/sonner';
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
      <ReactQueryDevtools initialIsOpen={false} />
      <Toaster />
    </QueryClientProvider>
  );
}
