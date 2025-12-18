/**
 * Sequence Character Operations Helpers
 * CRUD operations for sequence-specific character data and reference sheets
 *
 * NOTE: This file operates on the `characters` table (renamed from `sequence_characters`)
 * The "sequence characters" terminology is kept for backward compatibility in the API
 */

import { getDb } from '#db-client';
import type { Character, NewCharacter, SheetStatus } from '@/lib/db/schema';
import { characters } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

// Re-export types with legacy names for backward compatibility
export type { Character as SequenceCharacter } from '@/lib/db/schema';
export type { NewCharacter as NewSequenceCharacter } from '@/lib/db/schema';

// ============================================================================
// Core CRUD Operations
// ============================================================================

/**
 * Get a single sequence character by ID
 */
async function getSequenceCharacterById(id: string): Promise<Character | null> {
  const result = await getDb()
    .select()
    .from(characters)
    .where(eq(characters.id, id));
  return result[0] ?? null;
}

/**
 * Get a sequence character by sequence ID and character ID (from character bible)
 */
async function getSequenceCharacterByCharacterId(
  sequenceId: string,
  characterId: string
): Promise<Character | null> {
  const result = await getDb()
    .select()
    .from(characters)
    .where(
      and(
        eq(characters.sequenceId, sequenceId),
        eq(characters.characterId, characterId)
      )
    );
  return result[0] ?? null;
}

/**
 * Get all characters for a sequence
 */
export async function getSequenceCharacters(
  sequenceId: string
): Promise<Character[]> {
  return await getDb()
    .select()
    .from(characters)
    .where(eq(characters.sequenceId, sequenceId));
}

/**
 * Get sequence characters by their IDs
 */
async function getSequenceCharactersByIds(ids: string[]): Promise<Character[]> {
  if (ids.length === 0) return [];
  return await getDb()
    .select()
    .from(characters)
    .where(inArray(characters.id, ids));
}

/**
 * Get sequence characters with completed sheets
 */
export async function getSequenceCharactersWithSheets(
  sequenceId: string
): Promise<Character[]> {
  return await getDb()
    .select()
    .from(characters)
    .where(
      and(
        eq(characters.sequenceId, sequenceId),
        eq(characters.sheetStatus, 'completed')
      )
    );
}

/**
 * Create a new sequence character
 */
export async function createSequenceCharacter(
  data: NewCharacter
): Promise<Character> {
  const [character] = await getDb().insert(characters).values(data).returning();
  return character;
}

/**
 * Create multiple sequence characters in a transaction
 */
async function createSequenceCharactersBulk(
  data: NewCharacter[]
): Promise<Character[]> {
  if (data.length === 0) return [];
  return await getDb().transaction(async (tx) => {
    return await tx.insert(characters).values(data).returning();
  });
}

/**
 * Update a sequence character
 */
async function updateSequenceCharacter(
  id: string,
  data: Partial<NewCharacter>
): Promise<Character> {
  const [character] = await getDb()
    .update(characters)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(characters.id, id))
    .returning();

  if (!character) {
    throw new Error(`SequenceCharacter ${id} not found`);
  }

  return character;
}

/**
 * Delete a sequence character
 */
async function deleteSequenceCharacter(id: string): Promise<boolean> {
  const result = await getDb().delete(characters).where(eq(characters.id, id));
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Delete all characters for a sequence
 */
async function deleteSequenceCharacters(sequenceId: string): Promise<number> {
  const result = await getDb()
    .delete(characters)
    .where(eq(characters.sequenceId, sequenceId));
  return result.rowsAffected ?? 0;
}

// ============================================================================
// Sheet Generation Status Operations
// ============================================================================

/**
 * Update character sheet status
 */
export async function updateSheetStatus(
  id: string,
  status: SheetStatus,
  error?: string
): Promise<Character> {
  return await updateSequenceCharacter(id, {
    sheetStatus: status,
    sheetError: error ?? null,
    ...(status === 'completed' && { sheetGeneratedAt: new Date() }),
  });
}

/**
 * Update character sheet with generated image
 */
export async function updateCharacterSheet(
  id: string,
  sheetImageUrl: string,
  sheetImagePath: string
): Promise<Character> {
  return await updateSequenceCharacter(id, {
    sheetImageUrl,
    sheetImagePath,
    sheetStatus: 'completed',
    sheetGeneratedAt: new Date(),
    sheetError: null,
  });
}

/**
 * Get characters with pending or failed sheets for a sequence
 */
async function getCharactersNeedingSheets(
  sequenceId: string
): Promise<Character[]> {
  return await getDb()
    .select()
    .from(characters)
    .where(
      and(
        eq(characters.sequenceId, sequenceId),
        inArray(characters.sheetStatus, ['pending', 'failed'])
      )
    );
}
