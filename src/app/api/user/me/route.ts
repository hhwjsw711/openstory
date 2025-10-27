/**
 * Current User API Endpoint
 * GET /api/user/me - Get current user
 */

import { getSession } from '@/lib/auth/server';
import { ensureUserAndTeam, getUserDefaultTeam } from '@/lib/db/helpers';
import { handleApiError } from '@/lib/errors';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user) {
      // No session exists - signal client to create anonymous session
      return NextResponse.json(
        {
          success: false,
          message: 'REQUIRES_CLIENT_AUTH',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const authUser = session.user;
    const isAnonymous = authUser.isAnonymous === true;

    // Ensure user and team exist - this handles both:
    // 1. User doesn't exist in database (creates user + team)
    // 2. User exists but has no team (creates team only)
    const ensureResult = await ensureUserAndTeam(authUser);
    if (!ensureResult.success || !ensureResult.data) {
      return NextResponse.json(
        {
          success: false,
          message: ensureResult.error || 'Failed to ensure user and team',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Get complete team info with team name
    const teamMembership = await getUserDefaultTeam(authUser.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          user: ensureResult.data,
          isAuthenticated: !isAnonymous,
          isAnonymous,
          teamId: teamMembership?.teamId,
          teamRole: teamMembership?.role,
          teamName: teamMembership?.teamName,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/user/me] Error:', error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to get user',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
