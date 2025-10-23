/**
 * Update Member Role API Endpoint
 * PATCH /api/teams/[teamId]/members/[userId]/role - Update a member's role (owner only)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeamOwnerAccess, requireUser } from '@/lib/auth/action-utils';
import { handleApiError, ValidationError } from '@/lib/errors';
import { teamService } from '@/lib/services/team.service';

const updateRoleSchema = z.object({
  newRole: z.enum(['owner', 'admin', 'member', 'viewer']),
});

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
      throw new ValidationError('Invalid team ID or user ID format');
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = updateRoleSchema.parse(body);

    // Check authentication and authorization
    const user = await requireUser();
    await requireTeamOwnerAccess(user.id, teamId);

    // Update member role
    await teamService.updateMemberRole({
      teamId,
      userId,
      newRole: validated.newRole,
      requestingUserId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Member role updated successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[PATCH /api/teams/[teamId]/members/[userId]/role] Error:',
      error
    );

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request data',
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
        message: 'Failed to update member role',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
