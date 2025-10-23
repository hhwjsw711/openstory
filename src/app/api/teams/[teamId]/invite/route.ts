/**
 * Team Invitation API Endpoint
 * POST /api/teams/[teamId]/invite - Invite a member to the team (admin/owner only)
 * @deprecated Use /api/teams/[teamId]/invitations instead
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamAdminAccess, requireUser } from "@/lib/auth/action-utils";
import { handleApiError, ValidationError } from "@/lib/errors";
import { teamService } from "@/lib/services/team.service";

const inviteRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["member", "admin", "viewer"]).default("member"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;

    // Validate UUID
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(teamId);
    } catch {
      throw new ValidationError("Invalid team ID format");
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = inviteRequestSchema.parse(body);

    // Check authentication and authorization
    const user = await requireUser();
    await requireTeamAdminAccess(user.id, teamId);

    // Invite member
    const invitation = await teamService.createInvitation({
      teamId,
      email: validated.email,
      role: validated.role,
      invitedBy: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: { invitationId: invitation.id },
        message: "Invitation sent successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/teams/[teamId]/invite] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request data",
          errors: error.issues,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to invite member",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
