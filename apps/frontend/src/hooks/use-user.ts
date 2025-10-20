"use client";

import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";
import type { UserProfile } from "@/types/database";

interface UserData {
  user: UserProfile;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  teamId?: string;
  teamRole?: string;
  teamName?: string;
}

async function fetchUser(): Promise<UserData> {
  const response = await fetch("/api/v1/user/me");
  const result = await response.json();

  if (!response.ok || !result.success) {
    if (result.message === "REQUIRES_CLIENT_AUTH") {
      const { data, error } = await authClient.signIn.anonymous();

      if (!error && data) {
        const retryResponse = await fetch("/api/v1/user/me");
        const retryResult = await retryResponse.json();

        if (retryResponse.ok && retryResult.success && retryResult.data) {
          const teamResponse = await fetch("/api/v1/user/team");
          const teamResult = await teamResponse.json();

          return {
            ...retryResult.data,
            teamId: teamResult.data?.teamId,
            teamRole: teamResult.data?.role,
            teamName: teamResult.data?.teamName,
          };
        }
      }

      throw new Error(error?.message || "Failed to create anonymous session");
    }

    throw new Error(result.message || "Failed to fetch user");
  }

  if (!result.data) {
    throw new Error("No user data returned");
  }

  const teamResponse = await fetch("/api/v1/user/team");
  const teamResult = await teamResponse.json();

  return {
    ...result.data,
    teamId: teamResult.data?.teamId,
    teamRole: teamResult.data?.role,
    teamName: teamResult.data?.teamName,
  };
}

/**
 * Simple hook for client components that need user data
 * Automatically handles both authenticated and anonymous users with BetterAuth
 * Handles auth errors by creating new anonymous sessions
 */
export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: fetchUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Retry once for auth errors
      if (
        error instanceof Error &&
        (error.message.includes("authentication") ||
          error.message.includes("REQUIRES_CLIENT_AUTH"))
      ) {
        return failureCount < 1;
      }
      return failureCount < 1;
    },
    refetchOnWindowFocus: false, // Prevent refetch on focus to avoid session conflicts
  });
}
