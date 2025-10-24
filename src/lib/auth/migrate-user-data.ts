import { db } from '@/lib/db/client';
import {
  teams,
  teamMembers,
  sequences,
  styles,
  characters,
  vfx,
  audio,
  credits,
  user,
} from '@/lib/db/schema';
import { eq, and, lt, gte, ne, sql } from 'drizzle-orm';

export interface MigrationResult {
  success: boolean;
  targetTeamId: string;
  migrationType: 'merge' | 'transfer';
  sequencesTransferred: number;
  stylesTransferred: number;
  anonymousTeamId: string;
  creditsMerged: number;
}

/**
 * Migrates all anonymous user data to an authenticated user account.
 *
 * This function handles two scenarios:
 * - SCENARIO A: Returning user signing in from a new device (merge into existing team)
 * - SCENARIO B: New user or first-time signup (transfer team ownership)
 *
 * All operations run in a transaction - either all succeed or all fail.
 *
 * @param anonymousUserId - UUID of the anonymous user
 * @param newUserId - UUID of the authenticated user
 * @returns Migration result with details about was transferred
 * @throws Error if migration fails or anonymous user has no team
 */
export async function migrateAnonymousUserData(
  anonymousUserId: string,
  newUserId: string
): Promise<MigrationResult> {
  return await db.transaction(async (tx) => {
    // Set threshold for detecting recently created teams (5 seconds ago)
    const recentThreshold = new Date(Date.now() - 5000);

    // 1. Get the anonymous user's team (must be owner)
    const [anonymousTeamMember] = await tx
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, anonymousUserId),
          eq(teamMembers.role, 'owner')
        )
      )
      .limit(1);

    if (!anonymousTeamMember) {
      throw new Error(
        `Anonymous user team not found for user ${anonymousUserId}`
      );
    }

    const anonymousTeamId = anonymousTeamMember.teamId;

    // 2. Check if authenticated user has pre-existing teams (created before this session)
    const [existingTeam] = await tx
      .select({
        teamId: teamMembers.teamId,
        teamCreatedAt: teams.createdAt,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(
        and(
          eq(teamMembers.userId, newUserId),
          eq(teamMembers.role, 'owner'),
          lt(teams.createdAt, recentThreshold)
        )
      )
      .orderBy(teams.createdAt)
      .limit(1);

    let targetTeamId: string;
    let migrationType: 'merge' | 'transfer';
    let sequencesTransferred = 0;
    let stylesTransferred = 0;

    if (existingTeam) {
      // SCENARIO A: Returning user signing in from new device
      // Merge anonymous content into their existing team
      targetTeamId = existingTeam.teamId;
      migrationType = 'merge';

      // Transfer sequences to existing team
      const updatedSequences = await tx
        .update(sequences)
        .set({
          teamId: targetTeamId,
          createdBy: newUserId,
          updatedBy: newUserId,
          updatedAt: new Date(),
        })
        .where(eq(sequences.teamId, anonymousTeamId))
        .returning({ id: sequences.id });

      sequencesTransferred = updatedSequences.length;

      // Transfer styles to existing team
      const updatedStyles = await tx
        .update(styles)
        .set({
          teamId: targetTeamId,
          createdBy: newUserId,
          updatedAt: new Date(),
        })
        .where(eq(styles.teamId, anonymousTeamId))
        .returning({ id: styles.id });

      stylesTransferred = updatedStyles.length;

      // Delete anonymous team membership
      await tx
        .delete(teamMembers)
        .where(eq(teamMembers.userId, anonymousUserId));

      // Delete anonymous team
      await tx.delete(teams).where(eq(teams.id, anonymousTeamId));
    } else {
      // SCENARIO B: New user or first-time signup
      // Transfer ownership of anonymous team to authenticated user
      targetTeamId = anonymousTeamId;
      migrationType = 'transfer';

      // Transfer team ownership
      await tx
        .update(teamMembers)
        .set({ userId: newUserId })
        .where(
          and(
            eq(teamMembers.userId, anonymousUserId),
            eq(teamMembers.role, 'owner')
          )
        );

      // Transfer sequences ownership (teamId stays the same)
      const updatedSequences = await tx
        .update(sequences)
        .set({
          createdBy: newUserId,
          updatedBy: newUserId,
          updatedAt: new Date(),
        })
        .where(eq(sequences.createdBy, anonymousUserId))
        .returning({ id: sequences.id });

      sequencesTransferred = updatedSequences.length;

      // Transfer styles ownership
      const updatedStyles = await tx
        .update(styles)
        .set({
          createdBy: newUserId,
          updatedAt: new Date(),
        })
        .where(eq(styles.createdBy, anonymousUserId))
        .returning({ id: styles.id });

      stylesTransferred = updatedStyles.length;

      // Find and delete any auto-created team (created during signup trigger)
      const [autoCreatedTeam] = await tx
        .select({
          teamId: teamMembers.teamId,
          teamCreatedAt: teams.createdAt,
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(
          and(
            eq(teamMembers.userId, newUserId),
            eq(teamMembers.role, 'owner'),
            ne(teamMembers.teamId, anonymousTeamId),
            gte(teams.createdAt, recentThreshold)
          )
        )
        .limit(1);

      if (autoCreatedTeam) {
        const autoCreatedTeamId = autoCreatedTeam.teamId;

        // Delete auto-created team membership
        await tx
          .delete(teamMembers)
          .where(eq(teamMembers.teamId, autoCreatedTeamId));

        // Delete auto-created team
        await tx.delete(teams).where(eq(teams.id, autoCreatedTeamId));
      }
    }

    // 3. Transfer all other user-owned content (common to both scenarios)

    // Transfer characters
    await tx
      .update(characters)
      .set({
        createdBy: newUserId,
        updatedAt: new Date(),
      })
      .where(eq(characters.createdBy, anonymousUserId));

    // Transfer VFX
    await tx
      .update(vfx)
      .set({
        createdBy: newUserId,
        updatedAt: new Date(),
      })
      .where(eq(vfx.createdBy, anonymousUserId));

    // Transfer audio
    await tx
      .update(audio)
      .set({
        createdBy: newUserId,
        updatedAt: new Date(),
      })
      .where(eq(audio.createdBy, anonymousUserId));

    // 4. Merge credits
    const [anonymousCredits] = await tx
      .select({ balance: credits.balance })
      .from(credits)
      .where(eq(credits.userId, anonymousUserId));

    let creditsMerged = 0;

    if (anonymousCredits && Number(anonymousCredits.balance) > 0) {
      creditsMerged = Number(anonymousCredits.balance);

      // Get new user's current credits
      const [newUserCredits] = await tx
        .select({ balance: credits.balance })
        .from(credits)
        .where(eq(credits.userId, newUserId));

      const currentBalance = Number(newUserCredits?.balance ?? 0);
      const newBalance = currentBalance + creditsMerged;

      // Upsert combined balance
      await tx
        .insert(credits)
        .values({
          userId: newUserId,
          balance: newBalance.toFixed(2),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: credits.userId,
          set: {
            balance: sql`${credits.balance} + ${creditsMerged.toFixed(2)}`,
            updatedAt: new Date(),
          },
        });
    }

    // 5. Clean up anonymous user data
    await tx.delete(credits).where(eq(credits.userId, anonymousUserId));
    await tx.delete(teamMembers).where(eq(teamMembers.userId, anonymousUserId));
    await tx.delete(user).where(eq(user.id, anonymousUserId));

    // Note: BetterAuth will handle deleting from its own 'user' table

    // Return migration summary
    return {
      success: true,
      targetTeamId,
      migrationType,
      sequencesTransferred,
      stylesTransferred,
      anonymousTeamId,
      creditsMerged,
    };
  });
}
