/**
 * Server-side authentication utilities for BetterAuth
 * Provides session management for Server Actions and API routes
 */

import { TeamMember, teamMembers } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { User } from './config';
import { getAuth } from './config';
import { getHighestRole } from './constants';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { getDb } from '#db-client';

/**
 * Get the current session from server context
 * Works in Server Actions, API routes, and Server Components
 */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest();
    return getAuth().api.getSession({ headers: request.headers });
  }
);

/**
 * Get the current user from server context
 * Returns null if not authenticated
 */
export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest();
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    return session?.user;
  }
);

/**
 * Require authentication - throws error if not authenticated
 * Use in Server Actions and API routes that require authentication
 */
export async function requireAuth() {
  const user = await getCurrentUserFn();

  if (!user) {
    throw new Error('Authentication required');
  }

  return { user };
}

/**
 * Require active user status - throws error if user is pending or suspended
 * Use in routes that should only be accessible to active users
 */
export async function requireActiveAuth() {
  const { user } = await requireAuth();

  // Check user status
  const status = user.status;

  if (status === 'pending') {
    throw new Error('Account activation required');
  }

  if (status === 'suspended') {
    throw new Error('Account suspended');
  }

  return { user };
}

/**
 * Get user with team information
 * Returns user data with team context for authorization
 */
export const getUserWithTeamFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await getSessionFn();
    if (!session?.user) {
      return null;
    }
    try {
      // Fetch all team memberships for the user
      const teamMembersList: Pick<TeamMember, 'teamId' | 'role'>[] =
        await getDb()
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
        const highestRole = getHighestRole(
          teamMembersList.map((tm) => tm.role)
        );
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
);

/**
 * Check if user has access to a team resource
 * Used for team-based authorization
 */
export async function checkTeamAccess(teamId: string): Promise<boolean> {
  const userWithTeam = await getUserWithTeamFn();

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
  const user = await getCurrentUserFn();
  if (!user) return false;

  const status = (user as User & { status?: string }).status;
  return status === 'pending';
}

/**
 * Check if the current user is active
 * Returns true if user has active status or no status field (legacy users)
 */
export async function isUserActive(): Promise<boolean> {
  const user = await getCurrentUserFn();
  if (!user) return false;

  const status = (user as User & { status?: string }).status;
  // No status field means legacy user (treat as active)
  // or explicitly set to 'active'
  return !status || status === 'active';
}

/**
 * Sign out the current user
 */
export const signOutFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest();
    return getAuth().api.signOut({ headers: request.headers });
  }
);
