/**
 * Talent Fixture for E2E Tests
 * Creates test talent with sheets for testing talent selection flows
 */

import { createClient } from '@libsql/client';
import { ulid } from 'ulid';

export type TestTalent = {
  id: string;
  name: string;
  teamId: string;
  sheetId: string;
};

/**
 * Get a database client for test operations
 */
function getClient() {
  return createClient({ url: 'file:test.db' });
}

/**
 * Create test talent with a default sheet
 */
export async function createTestTalent(
  teamId: string,
  name: string
): Promise<TestTalent> {
  const talentId = ulid();
  const sheetId = ulid();
  const now = Date.now();

  const client = getClient();
  try {
    // Insert talent
    await client.execute({
      sql: `INSERT INTO talent (id, team_id, name, is_in_team_library, created_at, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)`,
      args: [talentId, teamId, name, now, now],
    });

    // Insert default sheet with real placeholder image
    // Using picsum.photos for real images that are always available
    await client.execute({
      sql: `INSERT INTO talent_sheets (id, talent_id, name, image_url, is_default, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, 'manual_upload', ?, ?)`,
      args: [
        sheetId,
        talentId,
        'Default',
        `https://picsum.photos/seed/${talentId}/512/512`, // Deterministic image based on talent ID
        now,
        now,
      ],
    });
  } finally {
    client.close();
  }

  return { id: talentId, name, teamId, sheetId };
}

/**
 * Create multiple test talents for a team
 */
export async function createTestTalentSet(
  teamId: string,
  names: string[]
): Promise<TestTalent[]> {
  const talents: TestTalent[] = [];
  for (const name of names) {
    const talent = await createTestTalent(teamId, name);
    talents.push(talent);
  }
  return talents;
}

/**
 * Clean up test talent by team ID
 */
export async function cleanupTestTalent(teamId: string): Promise<void> {
  const client = getClient();
  try {
    // talent_sheets will cascade delete from talent
    await client.execute({
      sql: 'DELETE FROM talent WHERE team_id = ?',
      args: [teamId],
    });
  } finally {
    client.close();
  }
}
