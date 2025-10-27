/**
 * Anonymous Session API Endpoint
 * POST /api/auth/anonymous - Create anonymous session
 */

import { createAnonymousSession } from '@/lib/auth/server';
import { ensureUserAndTeam } from '@/lib/db/helpers';
import { handleApiError } from '@/lib/errors';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const session = await createAnonymousSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to create anonymous session',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Ensure user has a record in our users table and a team
    const result = await ensureUserAndTeam(session.user);

    if (!result.success || !result.data) {
      console.error('[POST /api/auth/anonymous] Database error:', result.error);
      return NextResponse.json(
        {
          success: false,
          message: result.error || 'Failed to initialize user account',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: session.user,
          session: session.session,
          isAuthenticated: false,
          isAnonymous: true,
        },
        message: 'Anonymous session created successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/auth/anonymous] Error:', error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create anonymous session',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
