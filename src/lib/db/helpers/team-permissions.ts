/**
 * Team Permission Helpers
 * Utilities for checking team access and permissions using Drizzle ORM
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { teamMembers } from '@/lib/db/schema';
import type { TeamMemberRole } from '@/lib/db/schema/teams';

/**
 * Result from getUserTeam - contains team membership info
 */
export type UserTeamMembership = {
  teamId: string;
  role: TeamMemberRole;
  teamName: string;
  joinedAt: Date;
};

/**
 * Team member with user details
 */
export type TeamMemberWithDetails = {
  userId: string;
  role: TeamMemberRole;
  joinedAt: Date;
  fullName: string | null;
};

/**
 * Check if a user is a member of a team and return their role
 *
 * @param userId - The user's ID
 * @param teamId - The team's ID
 * @returns Team membership info if user is a member, null otherwise
 *
 * @example
 * ```ts
 * const membership = await getUserTeam(userId, teamId);
 * if (!membership) {
 *   return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
 * }
 * ```
 */
export async function getUserTeam(
  userId: string,
  teamId: string
): Promise<UserTeamMembership | null> {
  const result = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)),
    with: {
      team: {
        columns: {
          name: true,
        },
      },
    },
  });

  if (!result) {
    return null;
  }

  return {
    teamId: result.teamId,
    role: result.role,
    teamName: result.team.name,
    joinedAt: result.joinedAt,
  };
}

/**
 * Get a user's default/first team
 * Returns the team with the highest role (owner > admin > member > viewer)
 *
 * @param userId - The user's ID
 * @returns Team membership info if user has any teams, null otherwise
 *
 * @example
 * ```ts
 * const defaultTeam = await getUserDefaultTeam(userId);
 * if (!defaultTeam) {
 *   return NextResponse.json({ error: 'No team found' }, { status: 400 });
 * }
 * ```
 */
export async function getUserDefaultTeam(
  userId: string
): Promise<UserTeamMembership | null> {
  // Query with role ordering - owner first, viewer last
  const result = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, userId),
    with: {
      team: {
        columns: {
          name: true,
        },
      },
    },
    orderBy: (teamMembers, { sql }) => [
      sql`CASE
        WHEN ${teamMembers.role} = 'owner' THEN 1
        WHEN ${teamMembers.role} = 'admin' THEN 2
        WHEN ${teamMembers.role} = 'member' THEN 3
        WHEN ${teamMembers.role} = 'viewer' THEN 4
        ELSE 5
      END`,
    ],
  });

  if (!result) {
    return null;
  }

  return {
    teamId: result.teamId,
    role: result.role,
    teamName: result.team.name,
    joinedAt: result.joinedAt,
  };
}

/**
 * Check if a user can access a team (boolean check)
 * Simpler version of getUserTeam when you only need a yes/no answer
 *
 * @param userId - The user's ID
 * @param teamId - The team's ID
 * @returns true if user is a team member, false otherwise
 *
 * @example
 * ```ts
 * if (!(await canAccessTeam(userId, teamId))) {
 *   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
 * }
 * ```
 */
export async function canAccessTeam(
  userId: string,
  teamId: string
): Promise<boolean> {
  const membership = await getUserTeam(userId, teamId);
  return membership !== null;
}

/**
 * Check if a user can manage a team (admin or owner role)
 * Used for operations like inviting members, changing settings, etc.
 *
 * @param userId - The user's ID
 * @param teamId - The team's ID
 * @returns true if user has admin or owner role, false otherwise
 *
 * @example
 * ```ts
 * if (!(await canManageTeam(userId, teamId))) {
 *   return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
 * }
 * ```
 */
export async function canManageTeam(
  userId: string,
  teamId: string
): Promise<boolean> {
  const membership = await getUserTeam(userId, teamId);
  if (!membership) {
    return false;
  }

  return membership.role === 'owner' || membership.role === 'admin';
}

/**
 * Get all members of a team with their roles and user details
 *
 * @param teamId - The team's ID
 * @returns Array of team members with user details
 *
 * @example
 * ```ts
 * const members = await getTeamMembers(teamId);
 * console.log(`Team has ${members.length} members`);
 * ```
 */
export async function getTeamMembers(
  teamId: string
): Promise<TeamMemberWithDetails[]> {
  const members = await db.query.teamMembers.findMany({
    where: eq(teamMembers.teamId, teamId),
    with: {
      user: {
        columns: {
          fullName: true,
        },
      },
    },
    orderBy: (teamMembers, { sql }) => [
      // Order by role (owner first, viewer last)
      sql`CASE
        WHEN ${teamMembers.role} = 'owner' THEN 1
        WHEN ${teamMembers.role} = 'admin' THEN 2
        WHEN ${teamMembers.role} = 'member' THEN 3
        WHEN ${teamMembers.role} = 'viewer' THEN 4
        ELSE 5
      END`,
      // Then by join date
      teamMembers.joinedAt,
    ],
  });

  return members.map((member) => ({
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt,
    fullName: member.user.fullName,
  }));
}

/**
 * Get all teams for a user
 *
 * @param userId - The user's ID
 * @returns Array of team memberships
 *
 * @example
 * ```ts
 * const userTeams = await getUserTeams(userId);
 * console.log(`User is in ${userTeams.length} teams`);
 * ```
 */
export async function getUserTeams(
  userId: string
): Promise<UserTeamMembership[]> {
  const memberships = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: {
      team: {
        columns: {
          name: true,
        },
      },
    },
    orderBy: (teamMembers, { sql }) => [
      // Order by role (owner first, viewer last)
      sql`CASE
        WHEN ${teamMembers.role} = 'owner' THEN 1
        WHEN ${teamMembers.role} = 'admin' THEN 2
        WHEN ${teamMembers.role} = 'member' THEN 3
        WHEN ${teamMembers.role} = 'viewer' THEN 4
        ELSE 5
      END`,
    ],
  });

  return memberships.map((membership) => ({
    teamId: membership.teamId,
    role: membership.role,
    teamName: membership.team.name,
    joinedAt: membership.joinedAt,
  }));
}

/**
 * Require that a user has access to a team, throwing an error if not
 * Useful for protecting API routes
 *
 * @param userId - The user's ID
 * @param teamId - The team's ID
 * @returns Team membership info
 * @throws Error if user is not a team member
 *
 * @example
 * ```ts
 * const membership = await requireTeamAccess(userId, teamId);
 * // If we get here, user has access
 * ```
 */
export async function requireTeamAccess(
  userId: string,
  teamId: string
): Promise<UserTeamMembership> {
  const membership = await getUserTeam(userId, teamId);
  if (!membership) {
    throw new Error(`User ${userId} does not have access to team ${teamId}`);
  }
  return membership;
}

/**
 * Require that a user can manage a team, throwing an error if not
 * Useful for protecting management API routes
 *
 * @param userId - The user's ID
 * @param teamId - The team's ID
 * @returns Team membership info
 * @throws Error if user cannot manage the team
 *
 * @example
 * ```ts
 * await requireTeamManagement(userId, teamId);
 * // If we get here, user can manage the team
 * ```
 */
export async function requireTeamManagement(
  userId: string,
  teamId: string
): Promise<UserTeamMembership> {
  const membership = await getUserTeam(userId, teamId);
  if (!membership) {
    throw new Error(`User ${userId} does not have access to team ${teamId}`);
  }
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw new Error(
      `User ${userId} does not have management permissions for team ${teamId}`
    );
  }
  return membership;
}
