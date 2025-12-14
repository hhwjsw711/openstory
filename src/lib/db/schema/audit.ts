import { desc } from 'drizzle-orm';
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';
import { sequences } from './sequences';
import { teams } from './teams';
import { user } from './auth';

/**
 * Audit trail for script analysis operations
 * Tracks all attempts to analyze scripts with complete context for debugging and cost tracking
 */
export const scriptAnalysisAudit = sqliteTable(
  'script_analysis_audit',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey(),

    // Relations
    sequenceId: text('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Input data
    userScript: text('user_script').notNull(), // Original script from user
    systemPromptVersion: text('system_prompt_version', {
      length: 16,
    }).notNull(), // Hash of system prompt
    userPrompt: text('user_prompt').notNull(), // Full user prompt sent to AI (script + style config)
    styleConfig: text('style_config', { mode: 'json' }).notNull(), // Director DNA/style configuration
    model: text('model', { length: 100 }).notNull(), // AI model identifier (e.g., "cerebras/llama-3.3-70b")

    // Output data
    rawOutput: text('raw_output'), // Raw AI response before parsing (nullable on API error)
    parsedOutput: text('parsed_output', { mode: 'json' }), // Successfully parsed Scene array (nullable on parse error)

    // Error tracking
    apiError: text('api_error'), // Error from API call (network, auth, rate limit, etc.)
    parseError: text('parse_error'), // Error from validating/parsing output against schema

    // Resource usage
    tokenUsage: text('token_usage', { mode: 'json' }), // Raw token usage from AI provider
    durationMs: integer('duration_ms').notNull(), // Time taken for analysis in milliseconds

    // Status
    status: text('status', { length: 20 }).notNull(), // 'success', 'api_error', 'parse_error'

    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('script_analysis_audit_sequence_id_idx').on(table.sequenceId),
    index('script_analysis_audit_team_id_idx').on(table.teamId),
    index('script_analysis_audit_created_at_idx').on(desc(table.createdAt)),
    index('script_analysis_audit_status_idx').on(table.status),
  ]
);

type ScriptAnalysisAudit = typeof scriptAnalysisAudit.$inferSelect;
type InsertScriptAnalysisAudit = typeof scriptAnalysisAudit.$inferInsert;
