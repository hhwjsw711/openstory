/**
 * Script Analysis Audit Service
 * Handles creating and querying audit records for script analysis operations
 */

import { getDb } from '#db-client';
import type { SceneAnalysis } from '@/lib/ai/scene-analysis.schema';
import {
  scriptAnalysisAudit,
  type InsertScriptAnalysisAudit,
  type ScriptAnalysisAudit,
} from '@/lib/db/schema';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

/**
 * Input data for creating an audit record
 */
export interface CreateAuditRecordInput {
  sequenceId: string;
  teamId: string;
  userId: string;
  userScript: string;
  systemPromptVersion: string;
  userPrompt: string;
  styleConfig: Record<string, unknown>;
  model: string;
  rawOutput: string | null;
  parsedOutput: SceneAnalysis | null;
  apiError: string | null;
  parseError: string | null;
  tokenUsage: Record<string, unknown> | null;
  durationMs: number;
  status: 'success' | 'api_error' | 'parse_error';
}

/**
 * Create a new audit record for a script analysis attempt
 *
 * @param input - Audit record data
 * @returns Created audit record
 */
export async function createAuditRecord(
  input: CreateAuditRecordInput
): Promise<ScriptAnalysisAudit> {
  const record: InsertScriptAnalysisAudit = {
    sequenceId: input.sequenceId,
    teamId: input.teamId,
    userId: input.userId,
    userScript: input.userScript,
    systemPromptVersion: input.systemPromptVersion,
    userPrompt: input.userPrompt,
    styleConfig: input.styleConfig,
    model: input.model,
    rawOutput: input.rawOutput,
    parsedOutput: input.parsedOutput, // JSONB type
    apiError: input.apiError,
    parseError: input.parseError,
    tokenUsage: input.tokenUsage, // JSONB type
    durationMs: input.durationMs,
    status: input.status,
  };

  const [created] = await getDb()
    .insert(scriptAnalysisAudit)
    .values(record)
    .returning();

  return created;
}

/**
 * Get audit history for a specific sequence
 *
 * @param sequenceId - Sequence ID to get audit history for
 * @param limit - Maximum number of records to return (default: 50)
 * @returns Audit records ordered by most recent first
 */
export async function getSequenceAuditHistory(
  sequenceId: string,
  limit = 50
): Promise<ScriptAnalysisAudit[]> {
  return getDb()
    .select()
    .from(scriptAnalysisAudit)
    .where(eq(scriptAnalysisAudit.sequenceId, sequenceId))
    .orderBy(desc(scriptAnalysisAudit.createdAt))
    .limit(limit);
}

/**
 * Get the most recent audit record for a sequence
 *
 * @param sequenceId - Sequence ID
 * @returns Most recent audit record or null if none found
 */
export async function getLatestAuditRecord(
  sequenceId: string
): Promise<ScriptAnalysisAudit | null> {
  const [latest] = await getDb()
    .select()
    .from(scriptAnalysisAudit)
    .where(eq(scriptAnalysisAudit.sequenceId, sequenceId))
    .orderBy(desc(scriptAnalysisAudit.createdAt))
    .limit(1);

  return latest ?? null;
}

/**
 * Statistics for a team's script analysis usage
 */
export interface TeamAuditStats {
  totalAnalyses: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  averageDurationMs: number;
  modelUsage: Record<string, number>; // model -> count
}

/**
 * Get aggregated statistics for a team's script analysis usage
 *
 * @param teamId - Team ID
 * @param startDate - Optional start date for filtering
 * @param endDate - Optional end date for filtering
 * @returns Aggregated statistics
 */
export async function getTeamAuditStats(
  teamId: string,
  startDate?: Date,
  endDate?: Date
): Promise<TeamAuditStats> {
  // Build where clause with date filters
  const conditions = [eq(scriptAnalysisAudit.teamId, teamId)];

  if (startDate) {
    conditions.push(gte(scriptAnalysisAudit.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(scriptAnalysisAudit.createdAt, endDate));
  }

  const whereClause =
    conditions.length > 1 ? and(...conditions) : conditions[0];

  // Get all audit records for the team
  const records = await getDb()
    .select()
    .from(scriptAnalysisAudit)
    .where(whereClause);

  // Calculate statistics
  const stats: TeamAuditStats = {
    totalAnalyses: records.length,
    successfulAnalyses: records.filter((r) => r.status === 'success').length,
    failedAnalyses: records.filter((r) => r.status !== 'success').length,
    averageDurationMs: 0,
    modelUsage: {},
  };

  if (records.length === 0) {
    return stats;
  }

  // Aggregate data
  let totalDuration = 0;

  for (const record of records) {
    // Duration
    totalDuration += record.durationMs;

    // Model usage
    stats.modelUsage[record.model] = (stats.modelUsage[record.model] || 0) + 1;
  }

  stats.averageDurationMs = Math.round(totalDuration / records.length);

  return stats;
}

/**
 * Get audit records with errors for debugging
 *
 * @param teamId - Team ID
 * @param limit - Maximum number of records to return (default: 20)
 * @returns Audit records with errors, ordered by most recent first
 */
export async function getAuditRecordsWithErrors(
  teamId: string,
  limit = 20
): Promise<ScriptAnalysisAudit[]> {
  return getDb()
    .select()
    .from(scriptAnalysisAudit)
    .where(
      and(
        eq(scriptAnalysisAudit.teamId, teamId),
        sql`${scriptAnalysisAudit.status} IN ('api_error', 'parse_error')`
      )
    )
    .orderBy(desc(scriptAnalysisAudit.createdAt))
    .limit(limit);
}
