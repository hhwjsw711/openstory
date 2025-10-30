import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from 'drizzle-orm/pg-core';
import { sequences } from './sequences';
import { teams } from './teams';
import { user } from './auth';

/**
 * Audit trail for script analysis operations
 * Tracks all attempts to analyze scripts with complete context for debugging and cost tracking
 */
export const scriptAnalysisAudit = pgTable(
  'script_analysis_audit',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Relations
    sequenceId: uuid('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Input data
    userScript: text('user_script').notNull(), // Original script from user
    systemPromptVersion: varchar('system_prompt_version', {
      length: 16,
    }).notNull(), // Hash of system prompt
    userPrompt: text('user_prompt').notNull(), // Full user prompt sent to AI (script + style config)
    styleConfig: jsonb('style_config').notNull(), // Director DNA/style configuration
    model: varchar('model', { length: 100 }).notNull(), // AI model identifier (e.g., "cerebras/llama-3.3-70b")

    // Output data
    rawOutput: text('raw_output'), // Raw AI response before parsing (nullable on API error)
    parsedOutput: jsonb('parsed_output'), // Successfully parsed Scene array (nullable on parse error)

    // Error tracking
    apiError: text('api_error'), // Error from API call (network, auth, rate limit, etc.)
    parseError: text('parse_error'), // Error from validating/parsing output against schema

    // Resource usage
    tokenUsage: jsonb('token_usage'), // Raw token usage from AI provider
    durationMs: integer('duration_ms').notNull(), // Time taken for analysis in milliseconds

    // Status
    status: varchar('status', { length: 20 }).notNull(), // 'success', 'api_error', 'parse_error'

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('script_analysis_audit_sequence_id_idx').using(
      'btree',
      table.sequenceId.asc().nullsLast().op('uuid_ops')
    ),
    index('script_analysis_audit_team_id_idx').using(
      'btree',
      table.teamId.asc().nullsLast().op('uuid_ops')
    ),
    index('script_analysis_audit_created_at_idx').using(
      'btree',
      table.createdAt.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('script_analysis_audit_status_idx').using(
      'btree',
      table.status.asc().nullsLast().op('text_ops')
    ),
  ]
);

export type ScriptAnalysisAudit = typeof scriptAnalysisAudit.$inferSelect;
export type InsertScriptAnalysisAudit = typeof scriptAnalysisAudit.$inferInsert;
