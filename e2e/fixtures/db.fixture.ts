/**
 * Database Fixture for E2E Tests
 * Utilities for resetting and seeding test data
 */

import { like, sql } from 'drizzle-orm';
import { testDb, getTestClient } from './db-client';
import { user, teams, sequences, talent } from '@/lib/db/schema';

/**
 * Clean all test data from the database
 * Called before test suite to ensure clean state
 */
export async function cleanTestData(): Promise<void> {
  // Delete test users (cascades to sessions, team_members)
  await testDb.delete(user).where(like(user.email, '%@e2e.test'));

  // Delete test teams
  await testDb.delete(teams).where(like(teams.slug, 'test-team-%'));

  // Delete test sequences (if table exists)
  try {
    await testDb.delete(sequences).where(like(sequences.title, 'E2E Test%'));
  } catch {
    // Table may not exist
  }

  // Delete test talent (if table exists)
  try {
    await testDb.delete(talent).where(like(talent.name, 'E2E Test%'));
  } catch {
    // Table may not exist
  }
}

/**
 * Reset the entire test database
 * Use sparingly - prefer cleanTestData for faster cleanup
 */
export async function resetTestDatabase(): Promise<void> {
  const client = getTestClient();

  // Get all table names
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%'"
  );

  // Disable foreign key checks temporarily
  await testDb.run(sql`PRAGMA foreign_keys = OFF`);

  // Delete from all tables
  for (const row of result.rows) {
    const name = row.name as string;
    await client.execute(`DELETE FROM "${name}"`);
  }

  // Re-enable foreign key checks
  await testDb.run(sql`PRAGMA foreign_keys = ON`);
}
