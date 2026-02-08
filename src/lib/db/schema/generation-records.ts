/**
 * Generation Records Schema
 * Tracks provenance: what inputs were used to generate each entity's current output.
 * Enables O(1) staleness checks by comparing current input hash vs recorded input hash.
 *
 * @see src/lib/services/dag/generation-provenance.ts
 */

import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Generation records table
 * One record per entity — tracks what was used to generate its current output.
 */
export const generationRecords = sqliteTable(
  'generation_records',
  {
    entityId: text('entity_id').primaryKey().notNull(),
    inputHash: text('input_hash').notNull(),
    /** JSON object mapping dependency entity IDs to the version used: {"scene_123": 5, "cast_456": 3} */
    inputVersions: text('input_versions', { mode: 'json' })
      .$type<Record<string, number>>()
      .notNull(),
    /** AI model version identifier used for generation */
    generatorVersion: text('generator_version'),
    generatedAt: integer('generated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    outputArtifactUrl: text('output_artifact_url'),
  },
  (table) => [index('idx_gen_records_input_hash').on(table.inputHash)]
);

export type GenerationRecord = InferSelectModel<typeof generationRecords>;
export type NewGenerationRecord = InferInsertModel<typeof generationRecords>;
