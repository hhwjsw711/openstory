/**
 * Current User API Endpoint
 * GET /api/user/me - Get current user
 */

import { getSession } from '@/lib/auth/server';
import { db } from '@/lib/db/client';
import { user } from '@/lib/db/schema';
import { ensureUserAndTeam, getUserDefaultTeam } from '@/lib/db/helpers';
import { handleApiError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
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

    // Get user profile from database
    const userProfile = await db.query.user.findFirst({
      where: eq(user.id, authUser.id),
    });

    if (!userProfile) {
      // User doesn't exist in database, create them
      const createResult = await ensureUserAndTeam(authUser);
      if (!createResult.success || !createResult.data) {
        return NextResponse.json(
          {
            success: false,
            message: createResult.error || 'Failed to create user profile',
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
            user: createResult.data,
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
    }

    // Get team info for existing user
    const teamMembership = await getUserDefaultTeam(authUser.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          user: userProfile,
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
