/**
 * Team Members API Endpoint
 * GET /api/teams/[teamId]/members - List team members
 */

import { NextResponse } from 'next/server';
import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { handleApiError, ValidationError } from '@/lib/errors';
import { teamService } from '@/lib/services/team.service';
import { ulidSchema } from '@/lib/schemas/id.schemas';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;

    // Validate ULID

    try {
      ulidSchema.parse(teamId);
    } catch {
      throw new ValidationError('Invalid team ID format');
    }

    // Check authentication and authorization
    const user = await requireUser();
    await requireTeamMemberAccess(user.id, teamId);

    // Get team members
    const members = await teamService.getMembers(teamId);

    return NextResponse.json(
      {
        success: true,
        data: members,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/teams/[teamId]/members] Error:', error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch team members',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
