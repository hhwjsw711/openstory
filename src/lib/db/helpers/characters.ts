/**
 * Character Library Database Helpers
 * CRUD operations for team character library
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '#db-client';
import {
  characterMedia,
  characterSheets,
  characters,
  sequenceCharacterUsages,
} from '../schema';
import type {
  CharacterSheet,
  Character,
  CharacterWithSheets,
  NewCharacterMedia,
  NewCharacterSheet,
  NewCharacter,
} from '../schema';

// ============================================================================
// Character Queries
// ============================================================================

/**
 * Get a character by ID
 */
export async function getCharacterById(
  characterId: string
): Promise<Character | undefined> {
  return getDb().query.characters.findFirst({
    where: eq(characters.id, characterId),
  });
}

/**
 * Get a character with all related data
 */
export async function getCharacterWithRelations(characterId: string) {
  return getDb().query.characters.findFirst({
    where: eq(characters.id, characterId),
    with: {
      sheets: {
        orderBy: [
          desc(characterSheets.isDefault),
          desc(characterSheets.createdAt),
        ],
      },
      media: {
        orderBy: [desc(characterMedia.createdAt)],
      },
    },
  });
}

/**
 * Get all characters for a team with sheet counts
 */
export async function getTeamCharacters(
  teamId: string,
  options?: { favoritesOnly?: boolean }
): Promise<CharacterWithSheets[]> {
  const db = getDb();

  // Build where conditions
  const conditions = [eq(characters.teamId, teamId)];
  if (options?.favoritesOnly) {
    conditions.push(eq(characters.isFavorite, true));
  }

  // Get characters with sheet count subquery
  const results = await db
    .select({
      character: characters,
      sheetCount: sql<number>`(
        SELECT COUNT(*) FROM character_sheets
        WHERE character_sheets.character_id = ${characters.id}
      )`.as('sheet_count'),
    })
    .from(characters)
    .where(and(...conditions))
    .orderBy(desc(characters.isFavorite), asc(characters.name));

  // Get default sheets for all characters
  const characterIds = results.map((r) => r.character.id);
  if (characterIds.length === 0) {
    return [];
  }

  const defaultSheets = await db
    .select()
    .from(characterSheets)
    .where(
      and(
        sql`${characterSheets.characterId} IN (${sql.join(
          characterIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        eq(characterSheets.isDefault, true)
      )
    );

  const sheetMap = new Map<string, CharacterSheet>(
    defaultSheets.map((s) => [s.characterId, s])
  );

  return results.map((r) => ({
    ...r.character,
    sheetCount: r.sheetCount,
    sheets: [],
    defaultSheet: sheetMap.get(r.character.id) ?? null,
  }));
}

/**
 * Get characters used in a specific sequence
 */
export async function getCharactersForSequence(
  teamId: string,
  sequenceId: string
): Promise<CharacterWithSheets[]> {
  const db = getDb();

  const results = await db
    .select({
      character: characters,
      sheetCount: sql<number>`(
        SELECT COUNT(*) FROM character_sheets
        WHERE character_sheets.character_id = ${characters.id}
      )`.as('sheet_count'),
    })
    .from(characters)
    .innerJoin(
      sequenceCharacterUsages,
      and(
        eq(sequenceCharacterUsages.characterId, characters.id),
        eq(sequenceCharacterUsages.sequenceId, sequenceId)
      )
    )
    .where(eq(characters.teamId, teamId))
    .orderBy(desc(characters.isFavorite), asc(characters.name));

  // Get default sheets
  const characterIds = results.map((r) => r.character.id);
  if (characterIds.length === 0) {
    return [];
  }

  const defaultSheets = await db
    .select()
    .from(characterSheets)
    .where(
      and(
        sql`${characterSheets.characterId} IN (${sql.join(
          characterIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        eq(characterSheets.isDefault, true)
      )
    );

  const sheetMap = new Map<string, CharacterSheet>(
    defaultSheets.map((s) => [s.characterId, s])
  );

  return results.map((r) => ({
    ...r.character,
    sheetCount: r.sheetCount,
    sheets: [],
    defaultSheet: sheetMap.get(r.character.id) ?? null,
  }));
}

// ============================================================================
// Character CRUD
// ============================================================================

/**
 * Create a new character
 */
export async function createCharacter(data: NewCharacter): Promise<Character> {
  const [character] = await getDb().insert(characters).values(data).returning();
  return character;
}

/**
 * Update a character
 */
export async function updateCharacter(
  characterId: string,
  teamId: string,
  data: Partial<Omit<Character, 'id' | 'teamId' | 'createdAt' | 'createdBy'>>
): Promise<Character | undefined> {
  const [character] = await getDb()
    .update(characters)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(characters.id, characterId), eq(characters.teamId, teamId)))
    .returning();
  return character;
}

/**
 * Delete a character
 */
export async function deleteCharacter(
  characterId: string,
  teamId: string
): Promise<boolean> {
  const result = await getDb()
    .delete(characters)
    .where(and(eq(characters.id, characterId), eq(characters.teamId, teamId)));
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Toggle character favorite status
 */
export async function toggleCharacterFavorite(
  characterId: string,
  teamId: string
): Promise<Character | undefined> {
  const character = await getCharacterById(characterId);
  if (!character || character.teamId !== teamId) {
    return undefined;
  }

  return updateCharacter(characterId, teamId, {
    isFavorite: !character.isFavorite,
  });
}

// ============================================================================
// Character Sheet Operations
// ============================================================================

/**
 * Get a character sheet by ID
 */
export async function getCharacterSheetById(
  sheetId: string
): Promise<CharacterSheet | undefined> {
  return getDb().query.characterSheets.findFirst({
    where: eq(characterSheets.id, sheetId),
  });
}

/**
 * Create a character sheet
 */
export async function createCharacterSheet(
  data: NewCharacterSheet
): Promise<CharacterSheet> {
  const db = getDb();

  // If this is the default sheet, unset other defaults first
  if (data.isDefault) {
    await db
      .update(characterSheets)
      .set({ isDefault: false })
      .where(eq(characterSheets.characterId, data.characterId));
  }

  const [sheet] = await db.insert(characterSheets).values(data).returning();
  return sheet;
}

/**
 * Update a character sheet
 */
export async function updateCharacterSheet(
  sheetId: string,
  data: Partial<Omit<CharacterSheet, 'id' | 'characterId' | 'createdAt'>>
): Promise<CharacterSheet | undefined> {
  const db = getDb();

  // If setting as default, unset other defaults first
  if (data.isDefault) {
    const sheet = await getCharacterSheetById(sheetId);
    if (sheet) {
      await db
        .update(characterSheets)
        .set({ isDefault: false })
        .where(eq(characterSheets.characterId, sheet.characterId));
    }
  }

  const [updated] = await db
    .update(characterSheets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(characterSheets.id, sheetId))
    .returning();

  return updated;
}

/**
 * Delete a character sheet
 */
export async function deleteCharacterSheet(sheetId: string): Promise<boolean> {
  const result = await getDb()
    .delete(characterSheets)
    .where(eq(characterSheets.id, sheetId));
  return (result.rowsAffected ?? 0) > 0;
}

// ============================================================================
// Character Media Operations
// ============================================================================

/**
 * Create character media
 */
export async function createCharacterMediaRecord(data: NewCharacterMedia) {
  const [media] = await getDb().insert(characterMedia).values(data).returning();
  return media;
}

/**
 * Delete character media
 */
export async function deleteCharacterMediaRecord(
  mediaId: string
): Promise<boolean> {
  const result = await getDb()
    .delete(characterMedia)
    .where(eq(characterMedia.id, mediaId));
  return (result.rowsAffected ?? 0) > 0;
}
