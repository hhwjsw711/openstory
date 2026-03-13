/**
 * Talent Library Database Helpers
 * CRUD operations for team talent library (actors/actresses)
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '#db-client';
import { talent, talentMedia, talentSheets } from '../schema';
import type {
  NewTalent,
  NewTalentMedia,
  NewTalentSheet,
  Talent,
  TalentMediaRecord,
  TalentSheet,
  TalentWithSheets,
} from '../schema';

// ============================================================================
// Talent Queries
// ============================================================================

/**
 * Get a talent by ID
 */
export async function getTalentById(
  talentId: string
): Promise<Talent | undefined> {
  return getDb().query.talent.findFirst({
    where: eq(talent.id, talentId),
  });
}

/**
 * Get a talent with all related data
 */
export async function getTalentWithRelations(talentId: string) {
  return getDb().query.talent.findFirst({
    where: eq(talent.id, talentId),
    with: {
      sheets: {
        orderBy: [desc(talentSheets.isDefault), desc(talentSheets.createdAt)],
      },
      media: {
        orderBy: [desc(talentMedia.createdAt)],
      },
    },
  });
}

/**
 * Get all talent for a team with sheet counts
 */
export async function getTeamTalent(
  teamId: string,
  options?: { favoritesOnly?: boolean }
): Promise<TalentWithSheets[]> {
  const db = getDb();

  // Build where conditions
  const conditions = [eq(talent.teamId, teamId)];
  if (options?.favoritesOnly) {
    conditions.push(eq(talent.isFavorite, true));
  }

  // Get talent with sheet count subquery
  const results = await db
    .select({
      talent: talent,
      sheetCount: sql<number>`(
        SELECT COUNT(*) FROM talent_sheets
        WHERE talent_sheets.talent_id = ${talent.id}
      )`.as('sheet_count'),
    })
    .from(talent)
    .where(and(...conditions))
    .orderBy(desc(talent.isFavorite), asc(talent.name));

  // Get default sheets for all talent
  const talentIds = results.map((r) => r.talent.id);
  if (talentIds.length === 0) {
    return [];
  }

  const defaultSheets = await db
    .select()
    .from(talentSheets)
    .where(
      and(
        sql`${talentSheets.talentId} IN (${sql.join(
          talentIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        eq(talentSheets.isDefault, true)
      )
    );

  const sheetMap = new Map<string, TalentSheet>(
    defaultSheets.map((s) => [s.talentId, s])
  );

  // For talent without a default sheet, get their most recent sheet as fallback
  const talentWithoutDefault = talentIds.filter((id) => !sheetMap.has(id));
  if (talentWithoutDefault.length > 0) {
    const fallbackSheets = await db
      .select()
      .from(talentSheets)
      .where(
        sql`${talentSheets.talentId} IN (${sql.join(
          talentWithoutDefault.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .orderBy(desc(talentSheets.createdAt));

    // Take the first (most recent) sheet for each talent
    for (const sheet of fallbackSheets) {
      if (!sheetMap.has(sheet.talentId)) {
        sheetMap.set(sheet.talentId, sheet);
      }
    }
  }

  return results.map((r) => ({
    ...r.talent,
    sheetCount: r.sheetCount,
    sheets: [],
    defaultSheet: sheetMap.get(r.talent.id) ?? null,
  }));
}

/**
 * Get multiple talent by IDs with their default sheets
 * Used for talent matching during sequence generation
 */
export async function getTalentByIds(
  talentIds: string[],
  teamId: string
): Promise<TalentWithSheets[]> {
  if (talentIds.length === 0) {
    return [];
  }

  const db = getDb();

  // Get talent that belong to the team
  const results = await db
    .select({
      talent: talent,
      sheetCount: sql<number>`(
        SELECT COUNT(*) FROM talent_sheets
        WHERE talent_sheets.talent_id = ${talent.id}
      )`.as('sheet_count'),
    })
    .from(talent)
    .where(
      and(
        eq(talent.teamId, teamId),
        sql`${talent.id} IN (${sql.join(
          talentIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    );

  if (results.length === 0) {
    return [];
  }

  // Get default sheets for all fetched talent
  const fetchedIds = results.map((r) => r.talent.id);
  const defaultSheets = await db
    .select()
    .from(talentSheets)
    .where(
      and(
        sql`${talentSheets.talentId} IN (${sql.join(
          fetchedIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        eq(talentSheets.isDefault, true)
      )
    );

  const sheetMap = new Map<string, TalentSheet>(
    defaultSheets.map((s) => [s.talentId, s])
  );

  // For talent without a default sheet, get their most recent sheet as fallback
  const talentWithoutDefault = fetchedIds.filter((id) => !sheetMap.has(id));
  if (talentWithoutDefault.length > 0) {
    const fallbackSheets = await db
      .select()
      .from(talentSheets)
      .where(
        sql`${talentSheets.talentId} IN (${sql.join(
          talentWithoutDefault.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .orderBy(desc(talentSheets.createdAt));

    // Take the first (most recent) sheet for each talent
    for (const sheet of fallbackSheets) {
      if (!sheetMap.has(sheet.talentId)) {
        sheetMap.set(sheet.talentId, sheet);
      }
    }
  }

  return results.map((r) => ({
    ...r.talent,
    sheetCount: r.sheetCount,
    sheets: [],
    defaultSheet: sheetMap.get(r.talent.id) ?? null,
  }));
}

// ============================================================================
// Talent CRUD
// ============================================================================

/**
 * Create a new talent
 */
export async function createTalent(data: NewTalent): Promise<Talent> {
  const [created] = await getDb().insert(talent).values(data).returning();
  return created;
}

/**
 * Update a talent
 */
export async function updateTalent(
  talentId: string,
  teamId: string,
  data: Partial<Omit<Talent, 'id' | 'teamId' | 'createdAt' | 'createdBy'>>
): Promise<Talent | undefined> {
  const [updated] = await getDb()
    .update(talent)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(talent.id, talentId), eq(talent.teamId, teamId)))
    .returning();
  return updated;
}

/**
 * Delete a talent
 */
export async function deleteTalent(
  talentId: string,
  teamId: string
): Promise<boolean> {
  const result = await getDb()
    .delete(talent)
    .where(and(eq(talent.id, talentId), eq(talent.teamId, teamId)));
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Toggle talent favorite status
 */
export async function toggleTalentFavorite(
  talentId: string,
  teamId: string
): Promise<Talent | undefined> {
  const existing = await getTalentById(talentId);
  if (!existing || existing.teamId !== teamId) {
    return undefined;
  }

  return updateTalent(talentId, teamId, {
    isFavorite: !existing.isFavorite,
  });
}

// ============================================================================
// Talent Sheet Operations
// ============================================================================

/**
 * Get a talent sheet by ID
 */
export async function getTalentSheetById(
  sheetId: string
): Promise<TalentSheet | undefined> {
  return getDb().query.talentSheets.findFirst({
    where: eq(talentSheets.id, sheetId),
  });
}

/**
 * Create a talent sheet
 * Auto-defaults if this is the first sheet for the talent
 */
export async function createTalentSheet(
  data: NewTalentSheet
): Promise<TalentSheet> {
  const db = getDb();

  // Count existing sheets for this talent
  const existingSheets = await db
    .select({ count: sql<number>`count(*)` })
    .from(talentSheets)
    .where(eq(talentSheets.talentId, data.talentId));

  const sheetCount = existingSheets[0]?.count ?? 0;

  // Auto-default if first sheet, or use explicit isDefault value
  const shouldBeDefault = sheetCount === 0 || data.isDefault === true;

  // If setting as default and other sheets exist, unset them first
  if (shouldBeDefault && sheetCount > 0) {
    await db
      .update(talentSheets)
      .set({ isDefault: false })
      .where(eq(talentSheets.talentId, data.talentId));
  }

  const [sheet] = await db
    .insert(talentSheets)
    .values({ ...data, isDefault: shouldBeDefault })
    .returning();
  return sheet;
}

/**
 * Update a talent sheet
 */
export async function updateTalentSheet(
  sheetId: string,
  data: Partial<Omit<TalentSheet, 'id' | 'talentId' | 'createdAt'>>
): Promise<TalentSheet | undefined> {
  const db = getDb();

  // If setting as default, unset other defaults first
  if (data.isDefault) {
    const sheet = await getTalentSheetById(sheetId);
    if (sheet) {
      await db
        .update(talentSheets)
        .set({ isDefault: false })
        .where(eq(talentSheets.talentId, sheet.talentId));
    }
  }

  const [updated] = await db
    .update(talentSheets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(talentSheets.id, sheetId))
    .returning();

  return updated;
}

/**
 * Delete a talent sheet
 * Auto-promotes remaining sheet to default if deleting the current default
 */
export async function deleteTalentSheet(sheetId: string): Promise<boolean> {
  const db = getDb();

  // Get the sheet to be deleted
  const sheet = await getTalentSheetById(sheetId);
  if (!sheet) return false;

  // Delete the sheet
  const result = await db
    .delete(talentSheets)
    .where(eq(talentSheets.id, sheetId));

  if ((result.rowsAffected ?? 0) === 0) return false;

  // If deleted sheet was default, promote remaining sheet (if only one left)
  if (sheet.isDefault) {
    const remaining = await db
      .select()
      .from(talentSheets)
      .where(eq(talentSheets.talentId, sheet.talentId));

    if (remaining.length === 1) {
      await db
        .update(talentSheets)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(talentSheets.id, remaining[0].id));
    }
  }

  return true;
}

// ============================================================================
// Talent Media Operations
// ============================================================================

/**
 * Get a talent media record by ID
 */
export async function getTalentMediaById(
  mediaId: string
): Promise<TalentMediaRecord | undefined> {
  return getDb().query.talentMedia.findFirst({
    where: eq(talentMedia.id, mediaId),
  });
}

/**
 * Create talent media
 */
export async function createTalentMediaRecord(
  data: NewTalentMedia
): Promise<TalentMediaRecord> {
  const [media] = await getDb().insert(talentMedia).values(data).returning();
  return media;
}

/**
 * Delete talent media
 */
export async function deleteTalentMediaRecord(
  mediaId: string
): Promise<boolean> {
  const result = await getDb()
    .delete(talentMedia)
    .where(eq(talentMedia.id, mediaId));
  return (result.rowsAffected ?? 0) > 0;
}
