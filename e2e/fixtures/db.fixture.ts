/**
 * Database Fixture for E2E Tests
 * Utilities for resetting and seeding test data
 */

import { createClient } from '@libsql/client';

// Uses test.db (same as e2e dev server)
const client = createClient({ url: 'file:test.db' });

/**
 * Clean all test data from the database
 * Called before test suite to ensure clean state
 */
export async function cleanTestData(): Promise<void> {
  // Delete test users (cascades to sessions, team_members)
  await client.execute("DELETE FROM user WHERE email LIKE '%@e2e.test'");

  // Delete test teams
  await client.execute("DELETE FROM teams WHERE slug LIKE 'test-team-%'");

  // Delete test sequences (if table exists)
  try {
    await client.execute("DELETE FROM sequences WHERE title LIKE 'E2E Test%'");
  } catch {
    // Table may not exist
  }

  // Delete test talent (if table exists)
  try {
    await client.execute("DELETE FROM talent WHERE name LIKE 'E2E Test%'");
  } catch {
    // Table may not exist
  }
}

/**
 * Reset the entire test database
 * Use sparingly - prefer cleanTestData for faster cleanup
 */
export async function resetTestDatabase(): Promise<void> {
  // Get all table names
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%'"
  );

  // Disable foreign key checks temporarily
  await client.execute('PRAGMA foreign_keys = OFF');

  // Delete from all tables
  for (const row of result.rows) {
    const name = row.name as string;
    await client.execute(`DELETE FROM "${name}"`);
  }

  // Re-enable foreign key checks
  await client.execute('PRAGMA foreign_keys = ON');
}
