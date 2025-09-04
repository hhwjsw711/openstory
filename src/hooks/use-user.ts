"use client";

import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "#actions/user";
import { createBrowserClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types/database";

interface UserData {
  user: UserProfile;
  isAuthenticated: boolean;
  isAnonymous: boolean;
}

async function fetchUser(): Promise<UserData> {
  // Call the server action to get or create user
  const result = await getCurrentUser();

  if (!result.success) {
    // Handle case where server needs client to create session first
    if (result.error === "REQUIRES_CLIENT_AUTH") {
      // Create anonymous session on client
      const supabase = createBrowserClient();
      const { data, error } = await supabase.auth.signInAnonymously();

      if (!error && data?.session) {
        // Retry the server action with the new session
        const retryResult = await getCurrentUser();
        if (retryResult.success && retryResult.data) {
          return retryResult.data;
        }
      }

      // If we still can't authenticate, throw error
      throw new Error("Failed to create user session");
    }

    throw new Error(result.error || "Failed to fetch user");
  }

  if (!result.data) {
    throw new Error("No user data returned");
  }

  return result.data;
}

/**
 * Simple hook for client components that need user data
 * Automatically handles both authenticated and anonymous users
 * Handles refresh token errors by creating new anonymous sessions
 */
export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: fetchUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Retry once for auth errors
      if (error instanceof Error && error.message.includes("refresh_token")) {
        return failureCount < 1;
      }
      return failureCount < 1;
    },
    refetchOnWindowFocus: false, // Prevent refetch on focus to avoid refresh token errors
  });
}
