/**
 * Anonymous Session API Endpoint
 * POST /api/auth/anonymous - Create anonymous session
 */

import { createAnonymousSession } from '@/lib/auth/server';
import { db } from '@/lib/db/client';
import { teamMembers, teams, user } from '@/lib/db/schema';
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
    try {
      // Create user record if it doesn't exist (upsert)
      await db
        .insert(user)
        .values({
          id: session.user.id,
          name: session.user.name || 'Anonymous',
          email: session.user.email || `${session.user.id}@anonymous.local`,
          fullName: session.user.name || null,
        })
        .onConflictDoNothing();

      // Create default team for anonymous user
      const teamName = `Anonymous Team ${session.user.id.slice(0, 8)}`;
      const teamSlug = `anon-${session.user.id.slice(0, 8)}`;

      const [team] = await db
        .insert(teams)
        .values({
          name: teamName,
          slug: teamSlug,
        })
        .returning();

      if (!team) {
        console.error('[POST /api/auth/anonymous] Team creation failed');
        return NextResponse.json(
          {
            success: false,
            message: 'Failed to create team',
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }

      // Create team membership for anonymous user
      await db.insert(teamMembers).values({
        teamId: team.id,
        userId: session.user.id,
        role: 'owner',
      });
    } catch (error) {
      console.error('[POST /api/auth/anonymous] Database error:', error);
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to initialize user account',
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
