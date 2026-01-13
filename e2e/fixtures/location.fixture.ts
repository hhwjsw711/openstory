/**
 * Location Fixture for E2E Tests
 * Creates test library locations for testing location library flows
 */

import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { testDb } from './db-client';
import { locationLibrary } from '@/lib/db/schema';

export type TestLibraryLocation = {
  id: string;
  name: string;
  teamId: string;
  referenceImageUrl: string;
};

/**
 * Create test library location with reference image
 */
export async function createTestLibraryLocation(
  teamId: string,
  name: string
): Promise<TestLibraryLocation> {
  const locationId = ulid();
  const now = new Date();
  const referenceImageUrl = `https://picsum.photos/seed/${locationId}/1024/576`;

  await testDb.insert(locationLibrary).values({
    id: locationId,
    teamId,
    name,
    description: 'A test location for e2e testing',
    referenceImageUrl,
    createdAt: now,
    updatedAt: now,
  });

  return { id: locationId, name, teamId, referenceImageUrl };
}

/**
 * Create multiple test library locations for a team
 */
export async function createTestLibraryLocationSet(
  teamId: string,
  names: string[]
): Promise<TestLibraryLocation[]> {
  const locations: TestLibraryLocation[] = [];
  for (const name of names) {
    const location = await createTestLibraryLocation(teamId, name);
    locations.push(location);
  }
  return locations;
}

/**
 * Clean up test library locations by team ID (use only when test isolation isn't needed)
 */
export async function cleanupTestLocations(teamId: string): Promise<void> {
  await testDb
    .delete(locationLibrary)
    .where(eq(locationLibrary.teamId, teamId));
}

/**
 * Clean up a specific location by ID (use for parallel test isolation)
 */
export async function cleanupLocationById(locationId: string): Promise<void> {
  await testDb
    .delete(locationLibrary)
    .where(eq(locationLibrary.id, locationId));
}
