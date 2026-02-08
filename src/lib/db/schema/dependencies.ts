/**
 * Dependencies Schema
 * DAG edge table tracking which entities depend on which others.
 *
 * @see src/lib/services/dag/dependency-graph.ts
 */

import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Dependency type describes the relationship between entities.
 * Format: "{parent_type}_{child_type}" e.g., "script_scene", "scene_frame"
 */
const DEPENDENCY_TYPES = [
  'script_scene',
  'script_cast',
  'cast_character',
  'scene_frame',
  'character_frame',
  'frame_motion',
] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/**
 * Dependencies table
 * Stores directed edges in the dependency graph.
 * dependent_id DEPENDS ON dependency_id.
 *
 * Example: A Frame depends on a Scene → dependent_id=frame, dependency_id=scene
 */
export const dependencies = sqliteTable(
  'dependencies',
  {
    dependentId: text('dependent_id').notNull(),
    dependencyId: text('dependency_id').notNull(),
    dependencyType: text('dependency_type').$type<DependencyType>(),
  },
  (table) => [
    // Find what an entity depends on (upstream)
    index('idx_deps_dependent').on(table.dependentId),
    // Find what depends on an entity (downstream)
    index('idx_deps_upstream').on(table.dependencyId),
  ]
);

export type Dependency = InferSelectModel<typeof dependencies>;
export type NewDependency = InferInsertModel<typeof dependencies>;
