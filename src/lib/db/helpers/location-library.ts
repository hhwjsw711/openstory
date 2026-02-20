/**
 * Location Library Operations Helpers
 * CRUD operations for team-level location templates
 */

import { getDb } from '#db-client';
import type { LibraryLocation, NewLibraryLocation } from '@/lib/db/schema';
import { locationLibrary } from '@/lib/db/schema';
import { and, eq, ilike, inArray } from 'drizzle-orm';

// Re-export types for convenience
export type { LibraryLocation } from '@/lib/db/schema';
export type { NewLibraryLocation } from '@/lib/db/schema';

// ============================================================================
// Core CRUD Operations
// ============================================================================

/**
 * Get a single library location by ID
 */
export async function getLibraryLocationById(
  id: string
): Promise<LibraryLocation | null> {
  const result = await getDb()
    .select()
    .from(locationLibrary)
    .where(eq(locationLibrary.id, id));
  return result[0] ?? null;
}

/**
 * Get all library locations for a team
 */
export async function getTeamLibraryLocations(
  teamId: string
): Promise<LibraryLocation[]> {
  return await getDb()
    .select()
    .from(locationLibrary)
    .where(eq(locationLibrary.teamId, teamId));
}

/**
 * Get library locations by their IDs
 */
export async function getLibraryLocationsByIds(
  ids: string[]
): Promise<LibraryLocation[]> {
  if (ids.length === 0) return [];
  return await getDb()
    .select()
    .from(locationLibrary)
    .where(inArray(locationLibrary.id, ids));
}

/**
 * Search library locations by name
 */
export async function searchLibraryLocations(
  teamId: string,
  query: string,
  limit = 10
): Promise<LibraryLocation[]> {
  return await getDb()
    .select()
    .from(locationLibrary)
    .where(
      and(
        eq(locationLibrary.teamId, teamId),
        ilike(locationLibrary.name, `%${query}%`)
      )
    )
    .limit(limit);
}

/**
 * Create a new library location
 */
export async function createLibraryLocation(
  data: NewLibraryLocation
): Promise<LibraryLocation> {
  const [location] = await getDb()
    .insert(locationLibrary)
    .values(data)
    .returning();
  return location;
}

/**
 * Create multiple library locations in a single insert
 */
export async function createLibraryLocationsBulk(
  data: NewLibraryLocation[]
): Promise<LibraryLocation[]> {
  if (data.length === 0) return [];
  return await getDb().insert(locationLibrary).values(data).returning();
}

/**
 * Update a library location
 */
export async function updateLibraryLocation(
  id: string,
  data: Partial<NewLibraryLocation>
): Promise<LibraryLocation> {
  const [location] = await getDb()
    .update(locationLibrary)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(locationLibrary.id, id))
    .returning();

  if (!location) {
    throw new Error(`LibraryLocation ${id} not found`);
  }

  return location;
}

/**
 * Delete a library location
 */
export async function deleteLibraryLocation(id: string): Promise<boolean> {
  const result = await getDb()
    .delete(locationLibrary)
    .where(eq(locationLibrary.id, id));
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Delete all library locations for a team
 */
export async function deleteTeamLibraryLocations(
  teamId: string
): Promise<number> {
  const result = await getDb()
    .delete(locationLibrary)
    .where(eq(locationLibrary.teamId, teamId));
  return result.rowsAffected ?? 0;
}

// ============================================================================
// Reference Image Operations
// ============================================================================

/**
 * Update library location reference image
 */
export async function updateLibraryLocationReference(
  id: string,
  referenceImageUrl: string,
  referenceImagePath: string
): Promise<LibraryLocation> {
  return await updateLibraryLocation(id, {
    referenceImageUrl,
    referenceImagePath,
  });
}

/**
 * Get library locations with reference images
 */
export async function getLibraryLocationsWithReferences(
  teamId: string
): Promise<LibraryLocation[]> {
  const locations = await getDb()
    .select()
    .from(locationLibrary)
    .where(eq(locationLibrary.teamId, teamId));

  // Filter to only locations with reference images
  return locations.filter((loc) => loc.referenceImageUrl !== null);
}
