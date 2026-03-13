/**
 * Style Library Database Helpers
 * CRUD operations for team styles
 */

import { and, eq } from 'drizzle-orm';
import { getDb } from '#db-client';
import { styles } from '../schema';
import type { NewStyle, Style } from '../schema';

/**
 * Get a style by ID
 */
export async function getStyleById(
  styleId: string
): Promise<Style | undefined> {
  return getDb().query.styles.findFirst({
    where: eq(styles.id, styleId),
  });
}

/**
 * Create a new style
 */
export async function createStyle(data: NewStyle): Promise<Style> {
  const [style] = await getDb().insert(styles).values(data).returning();
  return style;
}

/**
 * Update a style (scoped to team)
 */
export async function updateStyle(
  styleId: string,
  teamId: string,
  data: Partial<Omit<Style, 'id' | 'teamId' | 'createdAt' | 'createdBy'>>
): Promise<Style | undefined> {
  const result = await getDb()
    .update(styles)
    .set(data)
    .where(and(eq(styles.id, styleId), eq(styles.teamId, teamId)))
    .returning();
  const style = Array.isArray(result) ? result[0] : undefined;
  return style;
}

/**
 * Delete a style (scoped to team)
 */
export async function deleteStyle(
  styleId: string,
  teamId: string
): Promise<void> {
  await getDb()
    .delete(styles)
    .where(and(eq(styles.id, styleId), eq(styles.teamId, teamId)));
}
