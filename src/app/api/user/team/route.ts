/**
 * User Team API Endpoint
 * GET /api/user/team - Get user's team
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/server";
import { handleApiError } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";

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
    const { data: membership, error } = await supabase
      .from("team_members")
      .select("team_id, role, teams(name)")
      .eq("user_id", user.id)
      .order("role", { ascending: false }) // Prefer owner/admin roles
      .limit(1)
      .single();

    if (error || !membership) {
      return NextResponse.json(
        {
          success: false,
          message: "No team membership found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    const teamName =
      membership.teams &&
      typeof membership.teams === "object" &&
      "name" in membership.teams
        ? (membership.teams.name as string)
        : "My Team";

    return NextResponse.json(
      {
        success: true,
        data: {
          teamId: membership.team_id,
          role: membership.role,
          teamName,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/user/team] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get user team",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
