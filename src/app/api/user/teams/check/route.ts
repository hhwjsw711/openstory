/**
 * Check Team Access API Endpoint
 * POST /api/user/teams/check - Check if user has access to a team
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth/server";
import { handleApiError } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";

const checkAccessSchema = z.object({
  teamId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required",
          hasAccess: false,
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = checkAccessSchema.parse(body);

    const supabase = createServerClient();
    const { data: membership, error } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .order("role", { ascending: false })
      .limit(1)
      .single();

    if (error || !membership) {
      return NextResponse.json(
        {
          success: true,
          data: {
            hasAccess: false,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    const hasAccess = membership.team_id === validated.teamId;

    return NextResponse.json(
      {
        success: true,
        data: {
          hasAccess,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[POST /api/user/teams/check] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request data",
          errors: error.issues,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to check team access",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
