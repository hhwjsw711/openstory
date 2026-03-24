import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function makeQueryClient() {
  let qc!: QueryClient;
  qc = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => {
        void qc.invalidateQueries({
          queryKey: mutation.options.mutationKey,
        });
      },
      onError: (error) => {
        console.error(
          '[MUTATION ERROR]',
          error instanceof Error ? error.message : error
        );
        toast.error(error.message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000,
      },
    },
  });
  return qc;
}

let browserQueryClient: QueryClient | undefined;

/**
 * Returns a QueryClient singleton on the client, fresh instance on the server.
 * Shared between TanStack Router context and Better Auth hooks.
 */
export function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
