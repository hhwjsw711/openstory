/**
 * Server-side authentication utilities for BetterAuth
 * Provides session management for Server Actions and API routes
 */

import { getDb } from '#db-client';
import { TeamMember, teamMembers } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import type { Session, User } from './config';
import { getAuth } from './config';
import type { TeamRole } from './constants';
import { getHighestRole } from './constants';

/**
 * Get the current session from server context
 * Works in Server Actions, API routes, and Server Components
 */
export async function getSession(): Promise<Session | null> {
  try {
    const headersList = await headers();
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: headersList,
    });

    return session;
  } catch (error) {
    console.error(
      '[Auth] Failed to get session:',
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Get the current user from server context
 * Returns null if not authenticated
 */
export async function getUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Require authentication - throws error if not authenticated
 * Use in Server Actions and API routes that require authentication
 */
export async function requireAuth(): Promise<{ session: Session; user: User }> {
  const session = await getSession();

  if (!session?.user) {
    throw new Error('Authentication required');
  }

  return { session, user: session.user };
}

/**
 * Require active user status - throws error if user is pending or suspended
 * Use in routes that should only be accessible to active users
 */
export async function requireActiveAuth(): Promise<{
  session: Session;
  user: User;
}> {
  const { session, user } = await requireAuth();

  // Check user status
  const status = (user as User & { status?: string }).status;

  if (status === 'pending') {
    throw new Error('Account activation required');
  }

  if (status === 'suspended') {
    throw new Error('Account suspended');
  }

  return { session, user };
}

/**
 * Get user with team information
 * Returns user data with team context for authorization
 */
export async function getUserWithTeam(): Promise<{
  user: User;
  teamId: string | null;
  teamRole: string | null;
} | null> {
  const session = await getSession();

  if (!session?.user) {
    return null;
  }

  try {
    // Fetch all team memberships for the user
    const teamMembersList: Pick<TeamMember, 'teamId' | 'role'>[] = await getDb()
      .select({
        teamId: teamMembers.teamId,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .where(eq(teamMembers.userId, session.user.id))
      .orderBy(asc(teamMembers.joinedAt)); // Oldest team first

    // If user has no teams, return null
    if (!teamMembersList || teamMembersList.length === 0) {
      return {
        user: session.user,
        teamId: null,
        teamRole: null,
      };
    }

    // If user has multiple teams, select the one with the highest role
    let selectedTeam = teamMembersList[0];
    if (teamMembersList.length > 1) {
      const highestRole = getHighestRole(teamMembersList.map((tm) => tm.role));
      selectedTeam =
        teamMembersList.find((tm) => tm.role === highestRole) ||
        teamMembersList[0];
    }

    return {
      user: session.user,
      teamId: selectedTeam.teamId,
      teamRole: selectedTeam.role,
    };
  } catch (error) {
    console.error('[Auth] Failed to fetch team info:', error);
    return {
      user: session.user,
      teamId: null,
      teamRole: null,
    };
  }
}

/**
 * Check if user has access to a team resource
 * Used for team-based authorization
 */
export async function checkTeamAccess(teamId: string): Promise<boolean> {
  const userWithTeam = await getUserWithTeam();

  if (!userWithTeam) {
    return false;
  }

  return userWithTeam.teamId === teamId;
}

/**
 * Check if the current user has pending status
 * Returns true if user needs to activate their account
 */
export async function isUserPending(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const status = (user as User & { status?: string }).status;
  return status === 'pending';
}

/**
 * Check if the current user is active
 * Returns true if user has active status or no status field (legacy users)
 */
export async function isUserActive(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const status = (user as User & { status?: string }).status;
  // No status field means legacy user (treat as active)
  // or explicitly set to 'active'
  return !status || status === 'active';
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const headersList = await headers();
    const auth = getAuth();
    const result = await auth.api.signOut({
      headers: headersList,
    });

    return { success: result.success };
  } catch (error) {
    console.error('[Auth] Failed to sign out:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign out',
    };
  }
}
