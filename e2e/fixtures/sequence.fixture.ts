/**
 * Sequence Fixture for E2E Tests
 * Creates pre-seeded sequences with frames and characters for testing
 */

import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { testDb } from './db-client';
import { styles, sequences, frames, characters } from '@/lib/db/schema';

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

/**
 * Create a test style for the team (required by sequence)
 */
async function createTestStyle(teamId: string): Promise<string> {
  const styleId = ulid();
  const now = new Date();

  const styleConfig = {
    artStyle: 'Cinematic',
    colorPalette: ['#000000', '#FFFFFF'],
    lighting: 'Natural',
    cameraWork: 'Standard',
    mood: 'Dramatic',
    referenceFilms: ['Test Film'],
    colorGrading: 'Natural',
  };

  await testDb.insert(styles).values({
    id: styleId,
    teamId,
    name: 'E2E Test Style',
    config: styleConfig,
    createdAt: now,
    updatedAt: now,
  });

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
  const now = new Date();

  await testDb.insert(sequences).values({
    id: sequenceId,
    teamId,
    title,
    status: 'completed',
    styleId,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  return { id: sequenceId, teamId, styleId, title };
}

/**
 * Create a test frame with a thumbnail (for variant testing)
 */
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
  const now = new Date();

  const {
    thumbnailUrl = TEST_IMAGES.thumbnail(frameId),
    variantImageUrl = null,
    variantImageStatus = 'pending',
  } = options;

  await testDb.insert(frames).values({
    id: frameId,
    sequenceId,
    orderIndex,
    thumbnailUrl,
    thumbnailStatus: 'completed',
    variantImageUrl,
    variantImageStatus,
    createdAt: now,
    updatedAt: now,
  });

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
  const now = new Date();

  const {
    sheetImageUrl = TEST_IMAGES.characterSheet(id),
    sheetStatus = 'completed',
  } = options;

  await testDb.insert(characters).values({
    id,
    sequenceId,
    characterId,
    name,
    talentId,
    age: '30s',
    sheetImageUrl,
    sheetStatus,
    createdAt: now,
    updatedAt: now,
  });

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
  const result = await testDb.query.frames.findFirst({
    where: eq(frames.id, frameId),
    columns: {
      id: true,
      thumbnailUrl: true,
      variantImageStatus: true,
    },
  });

  if (!result) return null;

  return {
    id: result.id,
    thumbnailUrl: result.thumbnailUrl,
    variantImageStatus: result.variantImageStatus,
  };
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
  const result = await testDb.query.characters.findFirst({
    where: eq(characters.id, characterId),
    columns: {
      id: true,
      name: true,
      talentId: true,
      sheetStatus: true,
    },
  });

  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    talentId: result.talentId,
    sheetStatus: result.sheetStatus,
  };
}

/**
 * Clean up all test sequences and related data for a team
 */
export async function cleanupTestSequences(teamId: string): Promise<void> {
  // characters and frames cascade delete from sequences
  await testDb.delete(sequences).where(eq(sequences.teamId, teamId));
  // Also clean up styles
  await testDb.delete(styles).where(eq(styles.teamId, teamId));
}
