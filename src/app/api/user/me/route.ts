/**
 * Current User API Endpoint
 * GET /api/user/me - Get current user
 */

import { createAnonymousSession, getSession } from '@/lib/auth/server';
import { db } from '@/lib/db/client';
import { user } from '@/lib/db/schema';
import { ensureUserAndTeam } from '@/lib/db/helpers';
import { handleApiError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user) {
      // No session exists, create anonymous session
      const anonymousSession = await createAnonymousSession();

      if (!anonymousSession?.user) {
        return NextResponse.json(
          {
            success: false,
            message: 'Failed to create anonymous session',
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }

      const authUser = anonymousSession.user;

      // Ensure user has database record and team
      const createResult = await ensureUserAndTeam(authUser);
      if (!createResult.success || !createResult.data) {
        return NextResponse.json(
          {
            success: false,
            message:
              createResult.error || 'Failed to create anonymous user profile',
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            user: createResult.data,
            isAuthenticated: false,
            isAnonymous: true,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
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

      return NextResponse.json(
        {
          success: true,
          data: {
            user: createResult.data,
            isAuthenticated: !isAnonymous,
            isAnonymous,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: userProfile,
          isAuthenticated: !isAnonymous,
          isAnonymous,
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
