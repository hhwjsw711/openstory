/**
 * Sequence Fixture for E2E Tests
 * Creates pre-seeded sequences with frames and characters for testing
 */

import { createClient } from '@libsql/client';
import { ulid } from 'ulid';

export type TestSequence = {
  id: string;
  teamId: string;
  styleId: string;
  title: string;
};

export type TestFrame = {
  id: string;
  sequenceId: string;
  orderIndex: number;
};

export type TestCharacter = {
  id: string;
  sequenceId: string;
  characterId: string;
  name: string;
};

/**
 * Get a database client for test operations
 */
function getClient() {
  return createClient({ url: 'file:test.db' });
}

/**
 * Create a test style for the team (required by sequence)
 */
async function createTestStyle(teamId: string): Promise<string> {
  const styleId = ulid();
  const now = Date.now();

  const styleConfig = JSON.stringify({
    artStyle: 'Cinematic',
    colorPalette: ['#000000', '#FFFFFF'],
    lighting: 'Natural',
    cameraWork: 'Standard',
    mood: 'Dramatic',
    referenceFilms: ['Test Film'],
    colorGrading: 'Natural',
  });

  const client = getClient();
  try {
    await client.execute({
      sql: `INSERT INTO styles (id, team_id, name, config, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [styleId, teamId, 'E2E Test Style', styleConfig, now, now],
    });
  } finally {
    client.close();
  }

  return styleId;
}

/**
 * Create a test sequence with a style
 */
export async function createTestSequence(
  teamId: string,
  userId: string,
  title = 'E2E Test Sequence'
): Promise<TestSequence> {
  const sequenceId = ulid();
  const styleId = await createTestStyle(teamId);
  const now = Date.now();

  const client = getClient();
  try {
    await client.execute({
      sql: `INSERT INTO sequences (id, team_id, title, status, style_id, created_by, created_at, updated_at)
            VALUES (?, ?, ?, 'completed', ?, ?, ?, ?)`,
      args: [sequenceId, teamId, title, styleId, userId, now, now],
    });
  } finally {
    client.close();
  }

  return { id: sequenceId, teamId, styleId, title };
}

/**
 * Create a test frame with a thumbnail (for variant testing)
 */
// Real test images that are always available
const TEST_IMAGES = {
  // Fal's official test image from documentation
  falTest: 'https://fal.media/files/elephant/8kkhB12hEZI2kkbU8pZPA_test.jpeg',
  // Picsum placeholder images (deterministic by seed)
  thumbnail: (seed: string) => `https://picsum.photos/seed/${seed}/1024/576`, // 16:9
  variantGrid: (seed: string) =>
    `https://picsum.photos/seed/${seed}-grid/3072/3072`, // 3x3 grid
  characterSheet: (seed: string) =>
    `https://picsum.photos/seed/${seed}-sheet/1920/1080`,
};

export async function createTestFrame(
  sequenceId: string,
  orderIndex: number,
  options: {
    thumbnailUrl?: string;
    variantImageUrl?: string;
    variantImageStatus?: 'pending' | 'generating' | 'completed' | 'failed';
  } = {}
): Promise<TestFrame> {
  const frameId = ulid();
  const now = Date.now();

  const {
    thumbnailUrl = TEST_IMAGES.thumbnail(frameId),
    variantImageUrl = null,
    variantImageStatus = 'pending',
  } = options;

  const client = getClient();
  try {
    await client.execute({
      sql: `INSERT INTO frames (id, sequence_id, order_index, thumbnail_url, thumbnail_status, variant_image_url, variant_image_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
      args: [
        frameId,
        sequenceId,
        orderIndex,
        thumbnailUrl,
        variantImageUrl,
        variantImageStatus,
        now,
        now,
      ],
    });
  } finally {
    client.close();
  }

  return { id: frameId, sequenceId, orderIndex };
}

/**
 * Create a test character for a sequence (for recast testing)
 */
export async function createTestCharacter(
  sequenceId: string,
  characterId: string,
  name: string,
  talentId: string | null = null,
  options: {
    sheetImageUrl?: string;
    sheetStatus?: 'pending' | 'generating' | 'completed' | 'failed';
  } = {}
): Promise<TestCharacter> {
  const id = ulid();
  const now = Date.now();

  const {
    sheetImageUrl = TEST_IMAGES.characterSheet(id),
    sheetStatus = 'completed',
  } = options;

  const client = getClient();
  try {
    await client.execute({
      sql: `INSERT INTO characters (id, sequence_id, character_id, name, talent_id, sheet_image_url, sheet_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        sequenceId,
        characterId,
        name,
        talentId,
        sheetImageUrl,
        sheetStatus,
        now,
        now,
      ],
    });
  } finally {
    client.close();
  }

  return { id, sequenceId, characterId, name };
}

/**
 * Get a frame by ID to verify test assertions
 */
export async function getTestFrame(frameId: string): Promise<{
  id: string;
  thumbnailUrl: string | null;
  variantImageStatus: string | null;
} | null> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: 'SELECT id, thumbnail_url, variant_image_status FROM frames WHERE id = ?',
      args: [frameId],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      thumbnailUrl: row.thumbnail_url as string | null,
      variantImageStatus: row.variant_image_status as string | null,
    };
  } finally {
    client.close();
  }
}

/**
 * Get a character by ID to verify test assertions
 */
export async function getTestCharacter(characterId: string): Promise<{
  id: string;
  name: string;
  talentId: string | null;
  sheetStatus: string | null;
} | null> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: 'SELECT id, name, talent_id, sheet_status FROM characters WHERE id = ?',
      args: [characterId],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      name: row.name as string,
      talentId: row.talent_id as string | null,
      sheetStatus: row.sheet_status as string | null,
    };
  } finally {
    client.close();
  }
}

/**
 * Clean up all test sequences and related data for a team
 */
export async function cleanupTestSequences(teamId: string): Promise<void> {
  const client = getClient();
  try {
    // characters and frames cascade delete from sequences
    await client.execute({
      sql: 'DELETE FROM sequences WHERE team_id = ?',
      args: [teamId],
    });
    // Also clean up styles
    await client.execute({
      sql: 'DELETE FROM styles WHERE team_id = ?',
      args: [teamId],
    });
  } finally {
    client.close();
  }
}
