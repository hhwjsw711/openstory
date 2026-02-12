/**
 * Lazy Invalidation System
 * Adapton-inspired pattern: marks immediate dependents as "potentially stale"
 * without cascading further. Staleness is verified only when queried.
 *
 * Uses Redis for:
 * - stale:pending:{entityId} sets — tracks which dependencies have changed
 * - entity:changed / entity:lifecycle channels — real-time UI broadcasts
 *
 * @module lib/services/dag/invalidation
 */

import { getRedis } from '#redis';
import { getDependents, computeEntityInputHash } from './dependency-graph';
import { getProvenance } from './generation-provenance';

/**
 * Mark immediate dependents as potentially stale when an entity changes.
 * Does NOT cascade — only marks direct dependents.
 */
export async function onEntityUpdate(
  entityId: string,
  newVersion: number,
  newContentHash: string
): Promise<void> {
  const redis = getRedis();

  const dependents = await getDependents(entityId);
  for (const dep of dependents) {
    await redis.sadd(`stale:pending:${dep.dependentId}`, entityId);
  }

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
 * Checks Redis markers, then verifies via input hash comparison.
 * Clears false alarms (e.g. dependency changed then reverted).
 */
export async function checkStaleness(entityId: string): Promise<{
  isStale: boolean;
  changedDependencies: string[];
}> {
  const redis = getRedis();
  const pendingDeps = await redis.smembers(`stale:pending:${entityId}`);

  if (pendingDeps.length === 0) {
    return { isStale: false, changedDependencies: [] };
  }

  const [provenance, currentInputHash] = await Promise.all([
    getProvenance(entityId),
    computeEntityInputHash(entityId),
  ]);

  // Never generated — needs generation
  if (!provenance) {
    return { isStale: true, changedDependencies: pendingDeps };
  }

  // No dependencies — root entity, clear false markers
  if (currentInputHash === null) {
    await redis.del(`stale:pending:${entityId}`);
    return { isStale: false, changedDependencies: [] };
  }

  // Compare hashes — if equal, dependency was changed then reverted
  if (provenance.inputHash === currentInputHash) {
    await redis.del(`stale:pending:${entityId}`);
    return { isStale: false, changedDependencies: [] };
  }

  return { isStale: true, changedDependencies: pendingDeps };
}

/**
 * O(1) staleness check: compare current input hash vs recorded hash.
 * Simpler than checkStaleness — doesn't use Redis markers.
 */
export async function needsRegeneration(entityId: string): Promise<boolean> {
  const [provenance, currentInputHash] = await Promise.all([
    getProvenance(entityId),
    computeEntityInputHash(entityId),
  ]);

  if (!provenance) return true;
  if (currentInputHash === null) return false;
  return provenance.inputHash !== currentInputHash;
}

/**
 * Clear stale markers for an entity after regeneration.
 */
export async function clearStaleMarkers(entityId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`stale:pending:${entityId}`);
}

/**
 * Broadcast a lifecycle state change via Redis for real-time UI.
 */
export async function broadcastLifecycleChange(
  entityId: string,
  newState: string
): Promise<void> {
  const redis = getRedis();
  await redis.publish(
    'entity:lifecycle',
    JSON.stringify({ entityId, state: newState, timestamp: Date.now() })
  );
}
