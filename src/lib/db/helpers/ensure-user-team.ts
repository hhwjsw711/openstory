/**
 * Ensure User and Team Helper
 *
 * Ensures a user has a database record and team membership.
 * Used by both anonymous and authenticated user creation flows.
 */

import { db } from '@/lib/db/client';
import type { User } from '@/lib/db/schema';
import { user, teamMembers, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

type UserWithTeamMembers = User & {
  teamMembers?: Array<{ teamId: string; role: string }>;
};

export interface EnsureUserTeamResult {
  success: boolean;
  data?: UserWithTeamMembers;
  error?: string;
}

/**
 * Ensure user exists in database with team membership
 * Creates user record, team, and membership if they don't exist
 *
 * @param authUser - User data from auth session
 * @returns Result with user data or error
 */
export async function ensureUserAndTeam(authUser: {
  id: string;
  name?: string | null;
  email?: string | null;
}): Promise<EnsureUserTeamResult> {
  try {
    // Check if user already exists with team
    const foundUser = await db.query.user.findFirst({
      where: eq(user.id, authUser.id),
    });

    if (foundUser) {
      // Check for team membership
      const memberships = await db
        .select({
          teamId: teamMembers.teamId,
          role: teamMembers.role,
        })
        .from(teamMembers)
        .where(eq(teamMembers.userId, authUser.id));

      // If user has team membership, we're done
      if (memberships.length > 0) {
        return {
          success: true,
          data: { ...foundUser, teamMembers: memberships },
        };
      }
    }

    // User doesn't exist or has no team - create both in a transaction
    const result = await db.transaction(async (tx) => {
      // Create user record if it doesn't exist (upsert)
      await tx
        .insert(user)
        .values({
          id: authUser.id,
          name: authUser.name || 'Anonymous',
          email: authUser.email || `${authUser.id}@anonymous.local`,
          fullName: authUser.name || null,
        })
        .onConflictDoNothing();

      // Create default team for user
      const teamName = authUser.name
        ? `${authUser.name}'s Team`
        : `Anonymous Team ${authUser.id.slice(0, 8)}`;
      const teamSlug = `team-${authUser.id.slice(0, 8)}`;

      const [team] = await tx
        .insert(teams)
        .values({
          name: teamName,
          slug: teamSlug,
        })
        .returning();

      if (!team) {
        throw new Error('Failed to create team');
      }

      // Create team membership
      await tx.insert(teamMembers).values({
        teamId: team.id,
        userId: authUser.id,
        role: 'owner',
      });

      // Return the created user with team membership
      const createdUser = await tx.query.user.findFirst({
        where: eq(user.id, authUser.id),
      });

      if (!createdUser) {
        throw new Error('Failed to retrieve created user');
      }

      return {
        user: createdUser,
        teamId: team.id,
      };
    });

    return {
      success: true,
      data: {
        ...result.user,
        teamMembers: [{ teamId: result.teamId, role: 'owner' }],
      },
    };
  } catch (error) {
    console.error('[ensureUserAndTeam] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    };
  }
}
