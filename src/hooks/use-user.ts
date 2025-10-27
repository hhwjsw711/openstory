'use client';

import { authClient, useSession } from '@/lib/auth/client';
import type { UserProfile } from '@/types/database';
import { useQuery } from '@tanstack/react-query';

interface UserData {
  user: UserProfile;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  teamId?: string;
  teamRole?: string;
  teamName?: string;
}

/**
 * Simple hook for client components that need user data
 * Automatically handles both authenticated and anonymous users with BetterAuth
 * Creates anonymous session if needed before fetching user data
 */
export function useUser() {
  // Check client-side session state (no HTTP request)
  const { data: session, isPending: isSessionPending } = useSession();

  return useQuery({
    queryKey: ['current-user'],
    queryFn: async (): Promise<UserData> => {
      // If no session exists, create anonymous session first
      if (!session) {
        const { error } = await authClient.signIn.anonymous();
        if (error) {
          throw new Error(
            error.message || 'Failed to create anonymous session'
          );
        }
      }

      // Fetch user data (will succeed since session now exists)
      const response = await fetch('/api/user/me');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch user');
      }

      if (!result.data) {
        throw new Error('No user data returned');
      }

      return result.data;
    },
    enabled: !isSessionPending, // Wait for session check to complete
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Retry once on failure
    refetchOnWindowFocus: false, // Prevent refetch on focus to avoid session conflicts
  });
}
