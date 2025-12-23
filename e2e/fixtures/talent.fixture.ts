/**
 * Talent Fixture for E2E Tests
 * Creates test talent with sheets for testing talent selection flows
 */

import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { testDb } from './db-client';
import { talent, talentSheets, talentMedia } from '@/lib/db/schema';

export type TestTalent = {
  id: string;
  name: string;
  teamId: string;
  sheetId: string;
};

export type TestTalentWithMedia = TestTalent & {
  mediaIds: string[];
};

/**
 * Create test talent with a default sheet
 */
export async function createTestTalent(
  teamId: string,
  name: string
): Promise<TestTalent> {
  const talentId = ulid();
  const sheetId = ulid();
  const now = new Date();

  // Insert talent
  await testDb.insert(talent).values({
    id: talentId,
    teamId,
    name,
    isInTeamLibrary: true,
    createdAt: now,
    updatedAt: now,
  });

  // Insert default sheet with real placeholder image
  // Using picsum.photos for real images that are always available
  await testDb.insert(talentSheets).values({
    id: sheetId,
    talentId,
    name: 'Default',
    imageUrl: `https://picsum.photos/seed/${talentId}/512/512`, // Deterministic image based on talent ID
    isDefault: true,
    source: 'manual_upload',
    createdAt: now,
    updatedAt: now,
  });

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
    const talentRecord = await createTestTalent(teamId, name);
    talents.push(talentRecord);
  }
  return talents;
}

/**
 * Create test talent with reference media
 */
export async function createTestTalentWithMedia(
  teamId: string,
  name: string,
  mediaCount = 2
): Promise<TestTalentWithMedia> {
  const talentId = ulid();
  const sheetId = ulid();
  const now = new Date();

  // Insert talent
  await testDb.insert(talent).values({
    id: talentId,
    teamId,
    name,
    isInTeamLibrary: true,
    createdAt: now,
    updatedAt: now,
  });

  // Insert default sheet
  await testDb.insert(talentSheets).values({
    id: sheetId,
    talentId,
    name: 'Default',
    imageUrl: `https://picsum.photos/seed/${talentId}/512/512`,
    isDefault: true,
    source: 'manual_upload',
    createdAt: now,
    updatedAt: now,
  });

  // Insert media records
  const mediaIds: string[] = [];
  for (let i = 0; i < mediaCount; i++) {
    const mediaId = ulid();
    mediaIds.push(mediaId);
    await testDb.insert(talentMedia).values({
      id: mediaId,
      talentId,
      type: 'image',
      url: `https://picsum.photos/seed/${mediaId}/400/400`,
      path: `${teamId}/${talentId}/${mediaId}.jpg`,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { id: talentId, name, teamId, sheetId, mediaIds };
}

/**
 * Clean up test talent by team ID
 */
export async function cleanupTestTalent(teamId: string): Promise<void> {
  // talent_sheets and talent_media will cascade delete from talent
  await testDb.delete(talent).where(eq(talent.teamId, teamId));
}
