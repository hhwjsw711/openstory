/**
 * Scoped Database Context
 * Factory that returns team-scoped query methods, auto-injecting teamId.
 * Sub-modules in ./scoped/ contain domain-specific methods.
 * Only this file and auth/config.ts should import getDb.
 */

import { and, eq } from 'drizzle-orm';
import { getDb } from '#db-client';
import type { Sequence, User } from '@/lib/db/schema';
import { sequences, teamMembers, teams, user } from '@/lib/db/schema';
import type { TeamMemberRole } from '@/lib/db/schema/teams';
import { sql } from 'drizzle-orm';
import {
  createSequencesMethods,
  createSequenceMethods,
} from '@/lib/db/scoped/sequences';
import { createFramesMethods } from '@/lib/db/scoped/frames';
import { createTalentMethods } from '@/lib/db/scoped/talent';
import { createStylesMethods } from '@/lib/db/scoped/styles';
import {
  createLocationsMethods,
  createLocationSheetsMethods,
} from '@/lib/db/scoped/location-library';
import { createLibraryMethods } from '@/lib/db/scoped/library';
import { createCharactersMethods } from '@/lib/db/scoped/characters';
import { createSequenceLocationsMethods } from '@/lib/db/scoped/sequence-locations';
import { createBillingMethods } from '@/lib/db/scoped/billing';
import { createApiKeysMethods } from '@/lib/db/scoped/api-keys';
import { createTeamManagementMethods } from '@/lib/db/scoped/team-management';
import { createAdminMethods } from '@/lib/db/scoped/admin';

// Re-export types from sub-modules
export type {
  MusicFieldsUpdate,
  MergedVideoFieldsUpdate,
} from '@/lib/db/scoped/sequences';
export type {
  GiftTokenStatus,
  GiftTokenWithStatus,
} from '@/lib/db/scoped/admin';

/**
 * Resolve a user's default team (highest-role team).
 * Module-level function for bootstrap before scopedDb exists.
 */
export async function resolveUserTeam(
  userId: string
): Promise<{ teamId: string; role: TeamMemberRole; teamName: string } | null> {
  const db = getDb();
  const [result] = await db
    .select({
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      teamName: teams.name,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))
    .orderBy(
      sql`CASE
        WHEN ${teamMembers.role} = 'owner' THEN 1
        WHEN ${teamMembers.role} = 'admin' THEN 2
        WHEN ${teamMembers.role} = 'member' THEN 3
        WHEN ${teamMembers.role} = 'viewer' THEN 4
        ELSE 5
      END`
    )
    .limit(1);

  return result ?? null;
}

/**
 * Check if a user is a member of a specific team and return their role.
 * Module-level function — does not require a scopedDb instance.
 */
export async function getUserTeamMembership(
  userId: string,
  teamId: string
): Promise<{ teamId: string; role: TeamMemberRole; teamName: string } | null> {
  const db = getDb();
  const [result] = await db
    .select({
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      teamName: teams.name,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)))
    .limit(1);

  return result ?? null;
}

/**
 * Get a sequence by ID without team scoping.
 * Only for admin operations where team context isn't available yet.
 */
export async function getSequenceByIdUnscoped(
  sequenceId: string
): Promise<Sequence | null> {
  const db = getDb();
  const [result] = await db
    .select()
    .from(sequences)
    .where(eq(sequences.id, sequenceId));
  return result ?? null;
}

/**
 * Ensure user exists in database with team membership.
 * Creates user record, team, and membership if they don't exist.
 * Bootstrap function — does not require a scopedDb instance.
 */
export async function ensureUserAndTeam(authUser: {
  id: string;
  name?: string | null;
  email?: string | null;
}): Promise<{
  success: boolean;
  data?: User & { teamMembers?: Array<{ teamId: string; role: string }> };
  error?: string;
}> {
  try {
    const db = getDb();

    const foundUser = await db.query.user.findFirst({
      where: eq(user.id, authUser.id),
    });

    if (foundUser) {
      const memberships = await db
        .select({ teamId: teamMembers.teamId, role: teamMembers.role })
        .from(teamMembers)
        .where(eq(teamMembers.userId, authUser.id));

      if (memberships.length > 0) {
        return {
          success: true,
          data: { ...foundUser, teamMembers: memberships },
        };
      }
    }

    await db
      .insert(user)
      .values({
        id: authUser.id,
        name: authUser.name || 'Anonymous',
        email: authUser.email || `${authUser.id}@anonymous.local`,
      })
      .onConflictDoNothing();

    const teamName = authUser.name
      ? `${authUser.name}'s Team`
      : `Anonymous Team ${authUser.id.slice(0, 8)}`;
    const teamSlug = `team-${authUser.id.slice(0, 8)}`;

    const [team] = await db
      .insert(teams)
      .values({ name: teamName, slug: teamSlug })
      .returning();

    if (!team) throw new Error('Failed to create team');

    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: authUser.id,
      role: 'owner',
    });

    const createdUser = await db.query.user.findFirst({
      where: eq(user.id, authUser.id),
    });

    if (!createdUser) throw new Error('Failed to retrieve created user');

    return {
      success: true,
      data: {
        ...createdUser,
        teamMembers: [{ teamId: team.id, role: 'owner' }],
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

export function createScopedDb(teamId: string) {
  const db = getDb();

  return {
    teamId,

    sequences: createSequencesMethods(db, teamId),
    sequence: (sequenceId: string) => createSequenceMethods(db, sequenceId),

    talent: createTalentMethods(db, teamId),
    styles: createStylesMethods(db, teamId),
    locations: createLocationsMethods(db, teamId),
    locationSheets: createLocationSheetsMethods(db),
    library: createLibraryMethods(db, teamId),

    frames: createFramesMethods(db),

    characters: createCharactersMethods(db),
    sequenceLocations: createSequenceLocationsMethods(db),

    billing: createBillingMethods(db, teamId),
    apiKeys: createApiKeysMethods(db, teamId),
    teamManagement: createTeamManagementMethods(db, teamId),
    admin: createAdminMethods(db),
  };
}

export type ScopedDb = ReturnType<typeof createScopedDb>;
