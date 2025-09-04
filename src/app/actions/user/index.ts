"use server";

import type { User } from "@supabase/supabase-js";
import { createSessionAwareClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types/database";

interface UserResponse {
  success: boolean;
  data?: {
    user: UserProfile;
    isAuthenticated: boolean;
    isAnonymous: boolean;
  };
  error?: string;
}

/**
 * Helper function to create an anonymous user
 */
async function createAnonymousUser(
  supabase: Awaited<ReturnType<typeof createSessionAwareClient>>,
): Promise<UserResponse> {
  const { data, error: anonError } = await supabase.auth.signInAnonymously();

  if (anonError) {
    console.error(
      "[createAnonymousUser] Failed to create anonymous session:",
      anonError,
    );
    return {
      success: false,
      error: anonError.message || "Failed to create anonymous session",
    };
  }

  if (!data.user) {
    return {
      success: false,
      error: "No user returned from anonymous sign-in",
    };
  }

  // Create user record and team for NEW anonymous user
  const result = await ensureUserAndTeam(supabase, data.user);
  if (!result.success) {
    return {
      success: false,
      error: result.error || "Failed to create user with team",
    };
  }

  // Return the new anonymous user
  return createAnonymousUserResponse(data.user);
}

/**
 * Helper function to create user profile from user data
 */
function createUserProfile(user: User): UserProfile {
  return {
    ...user,
    full_name: user.user_metadata?.full_name || null,
    avatar_url: user.user_metadata?.avatar_url || null,
    onboarding_completed: user.user_metadata?.onboarding_completed || false,
  };
}

/**
 * Helper function to create anonymous user response
 */
function createAnonymousUserResponse(user: User): UserResponse {
  const userProfile: UserProfile = {
    ...user,
    full_name: null,
    avatar_url: null,
    onboarding_completed: false,
  };

  return {
    success: true,
    data: {
      user: userProfile,
      isAuthenticated: false,
      isAnonymous: true,
    },
  };
}

/**
 * Get or create the current user
 * - Returns existing authenticated user if logged in
 * - Creates anonymous user if not authenticated
 * - Ensures user always has a team
 */
export async function getCurrentUser(): Promise<UserResponse> {
  try {
    const supabase = await createSessionAwareClient();

    // Get the authenticated user (verifies with Supabase Auth server)
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    // If no user or session error, try to create anonymous user
    if (!user || sessionError) {
      console.log(
        "[getCurrentUser] No user found, attempting to create anonymous user",
      );
      const anonResult = await createAnonymousUser(supabase);

      console.log("[getCurrentUser] Anonymous user created", anonResult);
      // If anonymous creation fails due to no session context, return special error
      if (
        !anonResult.success &&
        (anonResult.error?.includes("AuthSessionMissingError") ||
          anonResult.error?.includes("Auth session missing"))
      ) {
        console.log(
          "[getCurrentUser] Cannot create anonymous user in server action without existing session",
        );
        return {
          success: false,
          error: "REQUIRES_CLIENT_AUTH",
        };
      }

      return anonResult;
    }

    // We have a valid authenticated user
    // Just ensure user record exists (team should have been created during initial signup)
    const result = await ensureUserAndTeam(supabase, user);
    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to ensure user has team",
      };
    }

    const userProfile = createUserProfile(user);

    const isAnonymous = user.is_anonymous === true;

    return {
      success: true,
      data: {
        user: userProfile,
        isAuthenticated: !isAnonymous,
        isAnonymous,
      },
    };
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get user",
    };
  }
}

/**
 * Ensure user has a record and at least one team
 * Only creates team if user has no teams at all
 */
async function ensureUserAndTeam(
  supabase: Awaited<ReturnType<typeof createSessionAwareClient>>,
  user: User,
): Promise<{ success: boolean; error?: string }> {
  // First check if user record exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!existingUser) {
    // Create user record
    const { error: userInsertError } = await supabase.from("users").insert({
      id: user.id,
    });

    if (userInsertError) {
      return {
        success: false,
        error: `Failed to create user record: ${userInsertError.message}`,
      };
    }
  }

  // Check if user has any teams
  const { data: teams } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  // Only create a team if user has NO teams at all
  if (!teams || teams.length === 0) {
    const teamSlug = `user-${user.id.substring(0, 8)}-${Date.now()}`;

    // Create team
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name: "My Team",
        slug: teamSlug,
      })
      .select()
      .single();

    if (teamError) {
      return {
        success: false,
        error: `Failed to create team: ${teamError.message}`,
      };
    }

    // Add user as team owner
    const { error: memberError } = await supabase.from("team_members").insert({
      user_id: user.id,
      team_id: team.id,
      role: "owner",
    });

    if (memberError) {
      // Clean up team if we can't create membership
      await supabase.from("teams").delete().eq("id", team.id);
      return {
        success: false,
        error: `Failed to create team membership: ${memberError.message}`,
      };
    }
  }

  return { success: true };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSessionAwareClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sign out",
    };
  }
}
