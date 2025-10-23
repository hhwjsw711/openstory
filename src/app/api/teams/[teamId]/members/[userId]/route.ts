/**
 * Team Member Management API Endpoint
 * DELETE /api/teams/[teamId]/members/[userId] - Remove a member (admin/owner only)
 * PATCH /api/teams/[teamId]/members/[userId] - Update member role (owner only)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireTeamAdminAccess,
  requireTeamOwnerAccess,
  requireUser,
} from "@/lib/auth/action-utils";
import { handleApiError, ValidationError } from "@/lib/errors";
import { teamService } from "@/lib/services/team.service";

const updateRoleSchema = z.object({
  role: z.enum(["owner", "admin", "member", "viewer"]),
});

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ teamId: string; userId: string }> }
) {
  try {
    const { teamId, userId } = await params;

    // Validate UUIDs
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(teamId);
      uuidSchema.parse(userId);
    } catch {
      throw new ValidationError("Invalid team ID or user ID format");
    }

    // Check authentication and authorization
    const user = await requireUser();
    await requireTeamAdminAccess(user.id, teamId);

    // Remove member
    await teamService.removeMember({
      teamId,
      userId,
      requestingUserId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Member removed successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[DELETE /api/teams/[teamId]/members/[userId]] Error:",
      error
    );
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to remove member",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; userId: string }> }
) {
  try {
    const { teamId, userId } = await params;

    // Validate UUIDs
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(teamId);
      uuidSchema.parse(userId);
    } catch {
      throw new ValidationError("Invalid team ID or user ID format");
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = updateRoleSchema.parse(body);

    // Check authentication and authorization
    const user = await requireUser();
    await requireTeamOwnerAccess(user.id, teamId);

    // Update role
    await teamService.updateMemberRole({
      teamId,
      userId,
      newRole: validated.role,
      requestingUserId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Role updated successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/teams/[teamId]/members/[userId]] Error:", error);

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
        message: "Failed to update role",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
