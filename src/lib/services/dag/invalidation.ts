/**
 * Lazy Invalidation System
 * Adapton-inspired pattern: marks immediate dependents as "potentially stale"
 * without cascading further. Staleness is verified only when queried.
 *
 * Uses Redis for:
 * - stale:pending:{entityId} sets — tracks which dependencies have changed
 * - entity:changed channel — broadcasts changes for real-time UI
 *
 * @module lib/services/dag/invalidation
 */

import { getRedis } from '#redis';
import { getDependents } from './dependency-graph';
import { computeEntityInputHash } from './dependency-graph';
import { getProvenance } from './generation-provenance';

/**
 * Mark immediate dependents as potentially stale when an entity changes.
 * Does NOT cascade — only marks direct dependents.
 *
 * @param entityId - The entity that changed
 * @param newVersion - New version number
 * @param newContentHash - New content hash
 */
export async function onEntityUpdate(
  entityId: string,
  newVersion: number,
  newContentHash: string
): Promise<void> {
  const redis = getRedis();

  // Mark immediate dependents as potentially stale
  const dependents = await getDependents(entityId);
  for (const dep of dependents) {
    await redis.sadd(`stale:pending:${dep.dependentId}`, entityId);
  }

  // Broadcast change for real-time UI updates
  await redis.publish(
    'entity:changed',
    JSON.stringify({
      entityId,
      version: newVersion,
      contentHash: newContentHash,
      timestamp: Date.now(),
    })
  );
}

/**
 * Check if an entity is stale using lazy verification.
 *
 * 1. Check if there are pending stale markers in Redis
 * 2. If yes, verify by comparing input hashes
 * 3. If hashes match (false alarm — edit was reverted), clear the marker
 * 4. If hashes don't match, entity is genuinely stale
 *
 * @param entityId - Entity to check
 * @returns Object with staleness info
 */
export async function checkStaleness(entityId: string): Promise<{
  isStale: boolean;
  changedDependencies: string[];
}> {
  const redis = getRedis();

  // Check for pending stale markers
  const pendingDeps = await redis.smembers(`stale:pending:${entityId}`);

  if (pendingDeps.length === 0) {
    return { isStale: false, changedDependencies: [] };
  }

  // Verify by comparing input hashes
  const [provenance, currentInputHash] = await Promise.all([
    getProvenance(entityId),
    computeEntityInputHash(entityId),
  ]);

  // No generation record — entity was never generated, so it's "stale" in the sense it needs generation
  if (!provenance) {
    return { isStale: true, changedDependencies: pendingDeps };
  }

  // No dependencies — root entity, clear false markers
  if (currentInputHash === null) {
    await redis.del(`stale:pending:${entityId}`);
    return { isStale: false, changedDependencies: [] };
  }

  // Compare hashes
  if (provenance.inputHash === currentInputHash) {
    // False alarm — dependency was changed then reverted
    await redis.del(`stale:pending:${entityId}`);
    return { isStale: false, changedDependencies: [] };
  }

  // Genuinely stale
  return { isStale: true, changedDependencies: pendingDeps };
}

/**
 * Clear stale markers for an entity after it's been regenerated.
 *
 * @param entityId - Entity whose markers to clear
 */
export async function clearStaleMarkers(entityId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`stale:pending:${entityId}`);
}

/**
 * Broadcast a lifecycle state change via Redis for real-time UI.
 *
 * @param entityId - Entity whose state changed
 * @param newState - New lifecycle state
 */
export async function broadcastLifecycleChange(
  entityId: string,
  newState: string
): Promise<void> {
  const redis = getRedis();
  await redis.publish(
    'entity:lifecycle',
    JSON.stringify({
      entityId,
      state: newState,
      timestamp: Date.now(),
    })
  );
}
