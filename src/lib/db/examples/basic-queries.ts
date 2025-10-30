/**
 * Drizzle Database Client Usage Examples
 *
 * These examples demonstrate common database operations using Drizzle ORM.
 * Use these patterns in your API routes and services.
 */

import { db } from '@/lib/db/client';
import { frames, sequences, user } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

/**
 * SELECT Examples
 */

// Select all users
export async function getAllUsers() {
  return await db.select().from(user);
}

// Select user by ID
export async function getUserById(userId: string) {
  const result = await db.select().from(user).where(eq(user.id, userId));
  return result[0];
}

// Select with multiple conditions
export async function getActiveTeamMembers(_teamId: string) {
  // Note: This is a simplified example - would normally join with team_members
  return await db.select().from(user);
}

// Select with ordering and limit
export async function getRecentSequences(teamId: string, limit = 10) {
  return await db
    .select()
    .from(sequences)
    .where(eq(sequences.teamId, teamId))
    .orderBy(desc(sequences.createdAt))
    .limit(limit);
}

/**
 * INSERT Examples
 */

// Insert single record
export async function createUser(userData: {
  id: string;
  name: string;
  email: string;
  fullName: string | null;
}) {
  const result = await db.insert(user).values(userData).returning();
  return result[0];
}

// Insert multiple records
export async function createMultipleFrames(
  framesData: Array<{
    id: string;
    sequenceId: string;
    scriptSection: string;
    orderIndex: number;
  }>
) {
  return await db.insert(frames).values(framesData).returning();
}

/**
 * UPDATE Examples
 */

// Update single record
export async function updateUserName(userId: string, fullName: string) {
  const result = await db
    .update(user)
    .set({ fullName })
    .where(eq(user.id, userId))
    .returning();
  return result[0];
}

// Update with conditions
export async function updateSequenceStatus(
  sequenceId: string,
  status: 'draft' | 'processing' | 'completed'
) {
  return await db
    .update(sequences)
    .set({ status, updatedAt: new Date() })
    .where(eq(sequences.id, sequenceId))
    .returning();
}

/**
 * DELETE Examples
 */

// Delete single record
export async function deleteFrame(frameId: string) {
  return await db.delete(frames).where(eq(frames.id, frameId)).returning();
}

// Delete with conditions
export async function deleteSequenceFrames(sequenceId: string) {
  return await db
    .delete(frames)
    .where(eq(frames.sequenceId, sequenceId))
    .returning();
}

/**
 * TRANSACTION Examples
 */

// Run multiple operations in a transaction
export async function createSequenceWithFrames(
  sequenceData: {
    id: string;
    teamId: string;
    title: string;
    styleId: string;
    analysisModel: string;
  },
  framesData: Array<{
    id: string;
    sequenceId: string;
    scriptSection: string;
    orderIndex: number;
  }>
) {
  return await db.transaction(async (tx) => {
    // Create sequence
    const [sequence] = await tx
      .insert(sequences)
      .values(sequenceData)
      .returning();

    // Create frames
    const createdFrames = await tx
      .insert(frames)
      .values(framesData)
      .returning();

    return { sequence, frames: createdFrames };
  });
}

/**
 * RAW SQL Examples (use sparingly)
 */

// Execute raw SQL query
export async function getFrameCount(sequenceId: string) {
  const result = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM frames WHERE sequence_id = ${sequenceId}`
  );
  return result.rows[0]?.count ?? 0;
}

/**
 * RELATIONAL Queries (using schema relations)
 */

// Query with relations (requires proper relation setup in schema)
export async function getSequenceWithFrames(sequenceId: string) {
  // This requires relations to be properly defined in the schema
  return await db.query.sequences.findFirst({
    where: eq(sequences.id, sequenceId),
    with: {
      frames: true,
    },
  });
}

/**
 * AGGREGATION Examples
 */

// Count records
export async function countTeamSequences(teamId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(sequences)
    .where(eq(sequences.teamId, teamId));
  return result[0]?.count ?? 0;
}

/**
 * Type-safe query results
 */

// The return type is automatically inferred from the schema
export async function getTypedUser(userId: string) {
  const result = await db.select().from(user).where(eq(user.id, userId));
  // result is typed as Array<typeof user.$inferSelect>
  return result[0];
}

/**
 * Best Practices:
 *
 * 1. Always use parameterized queries (Drizzle handles this automatically)
 * 2. Use transactions for multi-step operations
 * 3. Leverage TypeScript types - avoid 'any'
 * 4. Use .returning() to get inserted/updated data
 * 5. Handle null/undefined cases properly
 * 6. Use schema imports for type safety
 * 7. Prefer Drizzle's query builder over raw SQL
 */
