/**
 * User Teams API Endpoint
 * GET /api/v1/user/teams - Get all user teams
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required",
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      );
    }

    const supabase = createServerClient();
    const { data: memberships, error } = await supabase
      .from("team_members")
      .select("team_id, role, joined_at, teams(name)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }

    const teams = (memberships || []).map((m) => {
      const teamName =
        m.teams && typeof m.teams === "object" && "name" in m.teams
          ? (m.teams.name as string)
          : "Unknown Team";

      return {
        teamId: m.team_id,
        role: m.role,
        teamName,
        joinedAt: m.joined_at,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: teams,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/v1/user/teams] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get user teams",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
