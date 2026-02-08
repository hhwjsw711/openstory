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
import { computeEntityInputHash } from './dependency-graph';

/**
 * Record the provenance of a generation.
 * Called after an entity is successfully generated.
 *
 * @param entityId - The generated entity
 * @param inputHash - Hash of all input dependencies at generation time
 * @param inputVersions - Map of dependency entity IDs to their version numbers
 * @param generatorVersion - AI model/generator version string
 * @param outputArtifactUrl - URL of generated artifact (image, video, etc.)
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
 *
 * @param entityId - Entity to look up
 * @returns Generation record, or null if never generated
 */
export async function getProvenance(
  entityId: string
): Promise<GenerationRecord | null> {
  const row = await getDb().query.generationRecords.findFirst({
    where: eq(generationRecords.entityId, entityId),
  });
  return row ?? null;
}

/**
 * Check if an entity needs regeneration.
 * Compares the current input hash (computed from live dependencies)
 * against the recorded input hash from the last generation.
 *
 * This is the O(1) staleness check from the architecture doc.
 *
 * @param entityId - Entity to check
 * @returns true if the entity needs regeneration, false if still valid
 */
export async function needsRegeneration(entityId: string): Promise<boolean> {
  const [provenance, currentInputHash] = await Promise.all([
    getProvenance(entityId),
    computeEntityInputHash(entityId),
  ]);

  // No generation record means it was never generated — needs generation
  if (!provenance) return true;

  // No dependencies means it's a root entity — doesn't need regeneration from deps
  if (currentInputHash === null) return false;

  // Compare recorded input hash vs current computed input hash
  return provenance.inputHash !== currentInputHash;
}
