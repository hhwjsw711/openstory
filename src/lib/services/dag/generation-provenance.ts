/**
 * Generation Provenance Service
 * Tracks what inputs were used to generate each entity's current output.
 * Enables O(1) staleness checks by comparing current input hash vs recorded hash.
 *
 * @module lib/services/dag/generation-provenance
 */

import { getDb } from '#db-client';
import { generationRecords } from '@/lib/db/schema/generation-records';
import type { GenerationRecord } from '@/lib/db/schema/generation-records';
import { eq } from 'drizzle-orm';

/**
 * Record the provenance of a generation.
 * Called after an entity is successfully generated.
 */
export async function recordGeneration(
  entityId: string,
  inputHash: string,
  inputVersions: Record<string, number>,
  generatorVersion?: string,
  outputArtifactUrl?: string
): Promise<void> {
  await getDb()
    .insert(generationRecords)
    .values({
      entityId,
      inputHash,
      inputVersions,
      generatorVersion: generatorVersion ?? null,
      generatedAt: new Date(),
      outputArtifactUrl: outputArtifactUrl ?? null,
    })
    .onConflictDoUpdate({
      target: generationRecords.entityId,
      set: {
        inputHash,
        inputVersions,
        generatorVersion: generatorVersion ?? null,
        generatedAt: new Date(),
        outputArtifactUrl: outputArtifactUrl ?? null,
      },
    });
}

/**
 * Get the generation provenance record for an entity.
 */
export async function getProvenance(
  entityId: string
): Promise<GenerationRecord | null> {
  const row = await getDb().query.generationRecords.findFirst({
    where: eq(generationRecords.entityId, entityId),
  });
  return row ?? null;
}
