'use client';

import { useSession } from '@/lib/auth/client';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@/lib/db/schema';

type UserData = {
  user: User;
  isAuthenticated: boolean;
  teamId: string | null;
  teamRole: string | null;
  teamName: string | null;
};

/**
 * Hook for client components that need user data
 * Requires authenticated session - unauthenticated users redirected by middleware
 */
export function useUser() {
  // Check client-side session state (no HTTP request)
  const { data: session, isPending: isSessionPending } = useSession();

  return useQuery({
    queryKey: ['current-user'],
    queryFn: async (): Promise<UserData> => {
      const response = await fetch('/api/user/me');
      const result: { success: boolean; data?: UserData; message?: string } =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch user');
      }

      if (!result.data) {
        throw new Error('No user data returned');
      }

      return result.data;
    },
    enabled: !isSessionPending && !!session, // Only fetch if session exists
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Retry once on failure
    refetchOnWindowFocus: false, // Prevent refetch on focus to avoid session conflicts
  });
}
