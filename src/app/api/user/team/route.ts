/**
 * User Team API Endpoint
 * GET /api/user/team - Get user's team
 */

import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/server';
import { handleApiError } from '@/lib/errors';
import { getUserDefaultTeam } from '@/lib/db/helpers';

export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const membership = await getUserDefaultTeam(user.id);

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          message: 'No team membership found',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          teamId: membership.teamId,
          role: membership.role,
          teamName: membership.teamName,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/user/team] Error:', error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to get user team',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
