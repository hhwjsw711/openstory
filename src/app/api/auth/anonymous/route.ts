/**
 * Anonymous Session API Endpoint
 * POST /api/auth/anonymous - Create anonymous session
 */

import { NextResponse } from "next/server";
import { createAnonymousSession } from "@/lib/auth/server";
import { handleApiError } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const session = await createAnonymousSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to create anonymous session",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Ensure user has a record in our users table and a team
    const supabase = createServerClient();

    // Create user record if it doesn't exist
    const { error: userError } = await supabase.from("users").upsert({
      id: session.user.id,
      full_name: session.user.name || null,
    });

    if (userError) {
      console.error(
        "[POST /api/auth/anonymous] User creation error:",
        userError
      );
      return NextResponse.json(
        {
          success: false,
          message: "Failed to initialize user account",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Create default team for anonymous user
    const teamName = `Anonymous Team ${session.user.id.slice(0, 8)}`;
    const teamSlug = `anon-${session.user.id.slice(0, 8)}`;

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name: teamName,
        slug: teamSlug,
      })
      .select()
      .single();

    if (teamError || !team) {
      console.error(
        "[POST /api/auth/anonymous] Team creation error:",
        teamError
      );
      return NextResponse.json(
        {
          success: false,
          message: "Failed to create team",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Create team membership for anonymous user
    const { error: membershipError } = await supabase
      .from("team_members")
      .insert({
        team_id: team.id,
        user_id: session.user.id,
        role: "owner",
      });

    if (membershipError) {
      console.error(
        "[POST /api/auth/anonymous] Team membership creation error:",
        membershipError
      );
      return NextResponse.json(
        {
          success: false,
          message: "Failed to create team membership",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: session.user,
          session: session.session,
          isAuthenticated: false,
          isAnonymous: true,
        },
        message: "Anonymous session created successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/auth/anonymous] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create anonymous session",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
