/**
 * Sequence Character Operations Helpers
 * CRUD operations for sequence-specific character data and reference sheets
 */

import { getDb } from '#db-client';
import type {
  NewSequenceCharacter,
  SequenceCharacter,
  SheetStatus,
} from '@/lib/db/schema';
import { sequenceCharacters } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

// ============================================================================
// Core CRUD Operations
// ============================================================================

/**
 * Get a single sequence character by ID
 */
export async function getSequenceCharacterById(
  id: string
): Promise<SequenceCharacter | null> {
  const result = await getDb()
    .select()
    .from(sequenceCharacters)
    .where(eq(sequenceCharacters.id, id));
  return result[0] ?? null;
}

/**
 * Get a sequence character by sequence ID and character ID (from character bible)
 */
export async function getSequenceCharacterByCharacterId(
  sequenceId: string,
  characterId: string
): Promise<SequenceCharacter | null> {
  const result = await getDb()
    .select()
    .from(sequenceCharacters)
    .where(
      and(
        eq(sequenceCharacters.sequenceId, sequenceId),
        eq(sequenceCharacters.characterId, characterId)
      )
    );
  return result[0] ?? null;
}

/**
 * Get all characters for a sequence
 */
export async function getSequenceCharacters(
  sequenceId: string
): Promise<SequenceCharacter[]> {
  return await getDb()
    .select()
    .from(sequenceCharacters)
    .where(eq(sequenceCharacters.sequenceId, sequenceId));
}

/**
 * Get sequence characters by their IDs
 */
export async function getSequenceCharactersByIds(
  ids: string[]
): Promise<SequenceCharacter[]> {
  if (ids.length === 0) return [];
  return await getDb()
    .select()
    .from(sequenceCharacters)
    .where(inArray(sequenceCharacters.id, ids));
}

/**
 * Get sequence characters with completed sheets
 */
export async function getSequenceCharactersWithSheets(
  sequenceId: string
): Promise<SequenceCharacter[]> {
  return await getDb()
    .select()
    .from(sequenceCharacters)
    .where(
      and(
        eq(sequenceCharacters.sequenceId, sequenceId),
        eq(sequenceCharacters.sheetStatus, 'completed')
      )
    );
}

/**
 * Create a new sequence character
 */
export async function createSequenceCharacter(
  data: NewSequenceCharacter
): Promise<SequenceCharacter> {
  const [character] = await getDb()
    .insert(sequenceCharacters)
    .values(data)
    .returning();
  return character;
}

/**
 * Create multiple sequence characters in a transaction
 */
export async function createSequenceCharactersBulk(
  data: NewSequenceCharacter[]
): Promise<SequenceCharacter[]> {
  if (data.length === 0) return [];
  return await getDb().transaction(async (tx) => {
    return await tx.insert(sequenceCharacters).values(data).returning();
  });
}

/**
 * Update a sequence character
 */
export async function updateSequenceCharacter(
  id: string,
  data: Partial<NewSequenceCharacter>
): Promise<SequenceCharacter> {
  const [character] = await getDb()
    .update(sequenceCharacters)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sequenceCharacters.id, id))
    .returning();

  if (!character) {
    throw new Error(`SequenceCharacter ${id} not found`);
  }

  return character;
}

/**
 * Delete a sequence character
 */
export async function deleteSequenceCharacter(id: string): Promise<boolean> {
  const result = await getDb()
    .delete(sequenceCharacters)
    .where(eq(sequenceCharacters.id, id));
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Delete all characters for a sequence
 */
export async function deleteSequenceCharacters(
  sequenceId: string
): Promise<number> {
  const result = await getDb()
    .delete(sequenceCharacters)
    .where(eq(sequenceCharacters.sequenceId, sequenceId));
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
): Promise<SequenceCharacter> {
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
): Promise<SequenceCharacter> {
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
export async function getCharactersNeedingSheets(
  sequenceId: string
): Promise<SequenceCharacter[]> {
  return await getDb()
    .select()
    .from(sequenceCharacters)
    .where(
      and(
        eq(sequenceCharacters.sequenceId, sequenceId),
        inArray(sequenceCharacters.sheetStatus, ['pending', 'failed'])
      )
    );
}
