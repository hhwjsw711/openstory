import { useSession } from '@/lib/auth/client';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUserFn } from '@/lib/auth/server';
import type { User } from '@/lib/auth/config';

/**
 * Hook for client components that need user data
 * Requires authenticated session - unauthenticated users redirected by middleware
 */
export function useUser() {
  // Check client-side session state (no HTTP request)
  const { data: session, isPending: isSessionPending } = useSession();

  return useQuery({
    queryKey: ['current-user'],
    queryFn: async (): Promise<User | undefined> => getCurrentUserFn(),
    enabled: !isSessionPending && !!session, // Only fetch if session exists
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Retry once on failure
    refetchOnWindowFocus: false, // Prevent refetch on focus to avoid session conflicts
  });
}
