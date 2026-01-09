/**
 * Sequence Location Operations Helpers
 * CRUD operations for sequence-specific location data and reference images
 */

import { getDb } from '#db-client';
import type {
  Frame,
  Location,
  NewLocation,
  ReferenceStatus,
} from '@/lib/db/schema';
import { frames, locations } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

// Re-export types for convenience
export type { Location as SequenceLocation } from '@/lib/db/schema';
export type { NewLocation as NewSequenceLocation } from '@/lib/db/schema';

// ============================================================================
// Core CRUD Operations
// ============================================================================

/**
 * Get a single sequence location by ID
 */
export async function getSequenceLocationById(
  id: string
): Promise<Location | null> {
  const result = await getDb()
    .select()
    .from(locations)
    .where(eq(locations.id, id));
  return result[0] ?? null;
}

/**
 * Get a sequence location by sequence ID and location ID (from location bible)
 */
export async function getSequenceLocationByLocationId(
  sequenceId: string,
  locationId: string
): Promise<Location | null> {
  const result = await getDb()
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.sequenceId, sequenceId),
        eq(locations.locationId, locationId)
      )
    );
  return result[0] ?? null;
}

/**
 * Get all locations for a sequence
 */
export async function getSequenceLocations(
  sequenceId: string
): Promise<Location[]> {
  return await getDb()
    .select()
    .from(locations)
    .where(eq(locations.sequenceId, sequenceId));
}

/**
 * Get sequence locations by their IDs
 */
export async function getSequenceLocationsByIds(
  ids: string[]
): Promise<Location[]> {
  if (ids.length === 0) return [];
  return await getDb()
    .select()
    .from(locations)
    .where(inArray(locations.id, ids));
}

/**
 * Get sequence locations with completed reference images
 */
export async function getSequenceLocationsWithReferences(
  sequenceId: string
): Promise<Location[]> {
  return await getDb()
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.sequenceId, sequenceId),
        eq(locations.referenceStatus, 'completed')
      )
    );
}

/**
 * Create a new sequence location
 */
export async function createSequenceLocation(
  data: NewLocation
): Promise<Location> {
  const [location] = await getDb().insert(locations).values(data).returning();
  return location;
}

/**
 * Create multiple sequence locations in a transaction
 */
export async function createSequenceLocationsBulk(
  data: NewLocation[]
): Promise<Location[]> {
  if (data.length === 0) return [];
  return await getDb().transaction(async (tx) => {
    return await tx.insert(locations).values(data).returning();
  });
}

/**
 * Update a sequence location
 */
export async function updateSequenceLocation(
  id: string,
  data: Partial<NewLocation>
): Promise<Location> {
  const [location] = await getDb()
    .update(locations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(locations.id, id))
    .returning();

  if (!location) {
    throw new Error(`SequenceLocation ${id} not found`);
  }

  return location;
}

/**
 * Delete a sequence location
 */
export async function deleteSequenceLocation(id: string): Promise<boolean> {
  const result = await getDb().delete(locations).where(eq(locations.id, id));
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Delete all locations for a sequence
 */
export async function deleteSequenceLocations(
  sequenceId: string
): Promise<number> {
  const result = await getDb()
    .delete(locations)
    .where(eq(locations.sequenceId, sequenceId));
  return result.rowsAffected ?? 0;
}

// ============================================================================
// Reference Image Generation Status Operations
// ============================================================================

/**
 * Update location reference status
 */
export async function updateReferenceStatus(
  id: string,
  status: ReferenceStatus,
  error?: string
): Promise<Location> {
  return await updateSequenceLocation(id, {
    referenceStatus: status,
    referenceError: error ?? null,
    ...(status === 'completed' && { referenceGeneratedAt: new Date() }),
  });
}

/**
 * Update location reference with generated image
 */
export async function updateLocationReference(
  id: string,
  referenceImageUrl: string,
  referenceImagePath: string
): Promise<Location> {
  return await updateSequenceLocation(id, {
    referenceImageUrl,
    referenceImagePath,
    referenceStatus: 'completed',
    referenceGeneratedAt: new Date(),
    referenceError: null,
  });
}

/**
 * Get locations with pending or failed reference images for a sequence
 */
export async function getLocationsNeedingReferences(
  sequenceId: string
): Promise<Location[]> {
  return await getDb()
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.sequenceId, sequenceId),
        inArray(locations.referenceStatus, ['pending', 'failed'])
      )
    );
}

// ============================================================================
// Frame-Location Relationship Operations
// ============================================================================

/**
 * Match a location to a scene's environmentTag
 */
export function locationMatchesTag(
  location: Location,
  environmentTag: string
): boolean {
  if (!environmentTag) return false;

  const consistencyTag = (location.consistencyTag ?? '').toLowerCase();
  const locName = location.name.toLowerCase();
  const locId = location.locationId.toLowerCase();
  const envTagLower = environmentTag.toLowerCase();

  // Check if any of the location identifiers match the environment tag
  if (consistencyTag && envTagLower.includes(consistencyTag)) return true;
  if (envTagLower.includes(locName)) return true;
  if (envTagLower.includes(locId)) return true;

  // Also check if location name contains the env tag (reverse match)
  if (locName.includes(envTagLower)) return true;

  return false;
}

/**
 * Get all frames in a sequence that are at a specific location
 * Matches by checking metadata.continuity.environmentTag
 *
 * @param sequenceId - The sequence ID
 * @param locationId - The location's database ID (not locationId from script)
 * @returns Array of frames at this location
 */
export async function getFramesForLocation(
  sequenceId: string,
  locationId: string
): Promise<Frame[]> {
  // Get the location to extract matching patterns
  const location = await getSequenceLocationById(locationId);
  if (!location || location.sequenceId !== sequenceId) {
    return [];
  }

  // Get all frames for the sequence
  const allFrames = await getDb()
    .select()
    .from(frames)
    .where(eq(frames.sequenceId, sequenceId));

  // Filter frames that are at this location
  return (allFrames as Frame[]).filter((frame) => {
    const environmentTag = frame.metadata?.continuity?.environmentTag ?? '';
    const sceneLocation = frame.metadata?.metadata?.location ?? '';

    // Match against environment tag or scene location
    return (
      (environmentTag && locationMatchesTag(location, environmentTag)) ||
      (sceneLocation && locationMatchesTag(location, sceneLocation))
    );
  });
}

/**
 * Get frame IDs for frames at a location (for recast operations)
 */
export async function getFrameIdsForLocation(
  sequenceId: string,
  locationId: string
): Promise<string[]> {
  const matchingFrames = await getFramesForLocation(sequenceId, locationId);
  return matchingFrames.map((f) => f.id);
}

/**
 * Match locations to a frame based on metadata
 * Used when generating frame images to include location references
 */
export function matchLocationsToFrame(
  frame: Pick<Frame, 'metadata'>,
  allLocations: Location[]
): Location[] {
  const environmentTag = frame.metadata?.continuity?.environmentTag ?? '';
  const sceneLocation = frame.metadata?.metadata?.location ?? '';

  if (!environmentTag && !sceneLocation) return [];

  return allLocations.filter((location) => {
    return (
      (environmentTag && locationMatchesTag(location, environmentTag)) ||
      (sceneLocation && locationMatchesTag(location, sceneLocation))
    );
  });
}

// ============================================================================
// Team Library Operations
// ============================================================================

/**
 * Get all locations with completed reference images across all team sequences
 * Used as a "location library" for recasting
 */
export async function getTeamLocationsLibrary(
  teamId: string,
  options?: {
    excludeSequenceId?: string;
    limit?: number;
  }
): Promise<(Location & { sequenceTitle: string })[]> {
  const { sequences } = await import('@/lib/db/schema');
  const result = await getDb()
    .select({
      location: locations,
      sequenceTitle: sequences.title,
    })
    .from(locations)
    .innerJoin(sequences, eq(locations.sequenceId, sequences.id))
    .where(
      and(
        eq(sequences.teamId, teamId),
        eq(locations.referenceStatus, 'completed'),
        options?.excludeSequenceId
          ? // Optionally exclude current sequence
            // to avoid showing duplicate locations
            undefined
          : undefined
      )
    )
    .limit(options?.limit ?? 100);

  return result.map((r) => ({
    ...r.location,
    sequenceTitle: r.sequenceTitle ?? 'Untitled',
  }));
}
