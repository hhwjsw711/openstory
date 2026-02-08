/**
 * Dependency Graph Service
 * Manages directed edges in the entity dependency DAG.
 * Provides topological sorting for correct regeneration ordering
 * and input hash computation for staleness detection.
 *
 * @module lib/services/dag/dependency-graph
 */

import { getDb } from '#db-client';
import { dependencies } from '@/lib/db/schema/dependencies';
import type { DependencyType } from '@/lib/db/schema/dependencies';
import { and, eq } from 'drizzle-orm';
import { computeInputHash } from './content-hash';
import { getContentHash } from './versioned-entity-store';

type DependencyEdge = {
  dependentId: string;
  dependencyId: string;
  dependencyType: DependencyType | null;
};

/**
 * Add a dependency edge: dependentId DEPENDS ON dependencyId.
 *
 * @param dependentId - The entity that depends on another
 * @param dependencyId - The entity being depended upon
 * @param type - Type of dependency relationship
 */
export async function addDependency(
  dependentId: string,
  dependencyId: string,
  type?: DependencyType
): Promise<void> {
  await getDb()
    .insert(dependencies)
    .values({
      dependentId,
      dependencyId,
      dependencyType: type ?? null,
    })
    .onConflictDoNothing();
}

/**
 * Remove a dependency edge.
 */
export async function removeDependency(
  dependentId: string,
  dependencyId: string
): Promise<void> {
  await getDb()
    .delete(dependencies)
    .where(
      and(
        eq(dependencies.dependentId, dependentId),
        eq(dependencies.dependencyId, dependencyId)
      )
    );
}

/**
 * Get upstream dependencies — entities that this entity depends on.
 *
 * @param entityId - The dependent entity
 * @returns Array of dependency edges
 */
export async function getDependencies(
  entityId: string
): Promise<DependencyEdge[]> {
  return getDb()
    .select()
    .from(dependencies)
    .where(eq(dependencies.dependentId, entityId));
}

/**
 * Get downstream dependents — entities that depend on this entity.
 *
 * @param entityId - The dependency entity
 * @returns Array of dependency edges
 */
export async function getDependents(
  entityId: string
): Promise<DependencyEdge[]> {
  return getDb()
    .select()
    .from(dependencies)
    .where(eq(dependencies.dependencyId, entityId));
}

/**
 * Compute the input hash for an entity based on all its dependency content hashes.
 * This is the O(1) staleness check mechanism: compare computeEntityInputHash result
 * against the recorded generation input hash.
 *
 * @param entityId - Entity to compute input hash for
 * @returns SHA-256 hash of sorted dependency content hashes, or null if no deps
 */
export async function computeEntityInputHash(
  entityId: string
): Promise<string | null> {
  const deps = await getDependencies(entityId);
  if (deps.length === 0) return null;

  const depHashes: string[] = [];
  for (const dep of deps) {
    const hash = await getContentHash(dep.dependencyId);
    if (hash) {
      depHashes.push(hash);
    }
  }

  if (depHashes.length === 0) return null;
  return computeInputHash(depHashes);
}

/**
 * Compute regeneration order for a set of stale entities using Kahn's algorithm.
 * Returns entities in topological order — process dependencies before dependents.
 *
 * @param staleEntityIds - Set of entity IDs that need regeneration
 * @returns Ordered array of entity IDs for processing
 */
export async function getRegenerationOrder(
  staleEntityIds: string[]
): Promise<string[]> {
  if (staleEntityIds.length === 0) return [];

  const staleSet = new Set(staleEntityIds);

  // Build adjacency list and in-degree counts for the stale subgraph
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of staleEntityIds) {
    adjacency.set(id, []);
    inDegree.set(id, 0);
  }

  // For each stale entity, check its dependencies within the stale set
  for (const id of staleEntityIds) {
    const deps = await getDependencies(id);
    for (const dep of deps) {
      if (staleSet.has(dep.dependencyId)) {
        // dep.dependencyId → id (dependency must come before dependent)
        adjacency.get(dep.dependencyId)?.push(id);
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
      }
    }
  }

  // Kahn's algorithm: start with nodes that have no dependencies in the stale set
  const queue: string[] = [];
  for (const id of staleEntityIds) {
    if ((inDegree.get(id) ?? 0) === 0) {
      queue.push(id);
    }
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    result.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const degree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, degree);
      if (degree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If result doesn't contain all stale entities, there's a cycle
  if (result.length !== staleEntityIds.length) {
    throw new Error(
      `Cycle detected in dependency graph among entities: ${staleEntityIds.filter((id) => !result.includes(id)).join(', ')}`
    );
  }

  return result;
}

/**
 * Get all transitive dependencies (full upstream tree).
 * Uses BFS to traverse the graph.
 *
 * @param entityId - Starting entity
 * @returns Set of all upstream entity IDs
 */
export async function getTransitiveDependencies(
  entityId: string
): Promise<Set<string>> {
  const visited = new Set<string>();
  const queue = [entityId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = await getDependencies(current);
    for (const dep of deps) {
      if (!visited.has(dep.dependencyId)) {
        queue.push(dep.dependencyId);
      }
    }
  }

  // Remove the starting entity itself
  visited.delete(entityId);
  return visited;
}
