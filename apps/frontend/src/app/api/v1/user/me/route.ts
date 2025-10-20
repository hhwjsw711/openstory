/**
 * Current User API Endpoint
 * GET /api/v1/user/me - Get current user
 */

import { NextResponse } from "next/server";
import { createAnonymousSession, getSession } from "@/lib/auth/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import type { UserProfile } from "@/types/database";

/**
 * Ensure user exists in database with team membership
 * NOTE: Team creation is handled automatically by the sync_betterauth_to_users trigger
 */
async function ensureUserAndTeam(authUser: {
  id: string;
  name?: string | null;
}): Promise<{
  success: boolean;
  data?: UserProfile;
  error?: string;
}> {
  const supabase = createServerClient();

  try {
    // Retry logic: The BetterAuth trigger needs time to create user and team
    const maxRetries = 3;
    const baseDelay = 50; // Start with 50ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { data: userWithTeam } = await supabase
        .from("users")
        .select(
          `
          *,
          team_members!inner (
            team_id,
            role
          )
        `,
        )
        .eq("id", authUser.id)
        .maybeSingle();

      // Early exit if user and team membership both exist
      if (userWithTeam?.team_members) {
        return { success: true, data: userWithTeam };
      }

      // Only wait if we're going to retry
      if (attempt < maxRetries - 1) {
        const jitter = Math.random() * 20;
        const delay = baseDelay * (attempt + 1) + jitter;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      error:
        "Failed to initialize user profile. The database trigger may not be running.",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error",
    };
  }
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user) {
      // No session exists, create anonymous session
      const anonymousSession = await createAnonymousSession();

      if (!anonymousSession?.user) {
        return NextResponse.json(
          {
            success: false,
            message: "Failed to create anonymous session",
            timestamp: new Date().toISOString(),
          },
          { status: 500 },
        );
      }

      const authUser = anonymousSession.user;

      // Ensure user has database record and team
      const createResult = await ensureUserAndTeam(authUser);
      if (!createResult.success || !createResult.data) {
        return NextResponse.json(
          {
            success: false,
            message:
              createResult.error || "Failed to create anonymous user profile",
            timestamp: new Date().toISOString(),
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            user: createResult.data,
            isAuthenticated: false,
            isAnonymous: true,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    const authUser = session.user;
    const isAnonymous = authUser.isAnonymous === true;

    // Get user profile from database
    const supabase = createServerClient();
    const { data: userProfile, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error || !userProfile) {
      // User doesn't exist in database, create them
      const createResult = await ensureUserAndTeam(authUser);
      if (!createResult.success || !createResult.data) {
        return NextResponse.json(
          {
            success: false,
            message: createResult.error || "Failed to create user profile",
            timestamp: new Date().toISOString(),
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            user: createResult.data,
            isAuthenticated: !isAnonymous,
            isAnonymous,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: userProfile,
          isAuthenticated: !isAnonymous,
          isAnonymous,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/v1/user/me] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get user",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
