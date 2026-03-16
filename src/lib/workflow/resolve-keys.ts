/**
 * Workflow API Key Resolution
 *
 * Resolves team-specific API keys for use in workflow steps.
 * Call this at the beginning of a workflow to get the keys,
 * then pass them through to AI client calls.
 */

import { createScopedDb } from '@/lib/db/scoped';

export type ResolvedApiKeys = {
  /** Team's own OpenRouter key, or undefined to use platform key */
  openRouterApiKey?: string;
  /** Team's own Fal.ai key, or undefined to use platform key */
  falApiKey?: string;
};

/**
 * Resolve API keys for a team's workflow execution.
 * Returns team-provided keys when configured, undefined otherwise
 * (callers fall back to platform env keys when undefined).
 *
 * Usage in workflows:
 * ```typescript
 * const keys = await context.run('resolve-api-keys', () =>
 *   resolveWorkflowApiKeys(input.teamId)
 * );
 * // Then pass keys.openRouterApiKey to LLM calls
 * // and keys.falApiKey to image/motion generation
 * ```
 */
export async function resolveWorkflowApiKeys(
  teamId: string | undefined
): Promise<ResolvedApiKeys> {
  if (!teamId) {
    return {};
  }

  const scopedDb = createScopedDb(teamId);
  const [openrouter, fal] = await Promise.all([
    scopedDb.apiKeys.resolveKey('openrouter'),
    scopedDb.apiKeys.resolveKey('fal'),
  ]);

  return {
    openRouterApiKey: openrouter.source === 'team' ? openrouter.key : undefined,
    falApiKey: fal.source === 'team' ? fal.key : undefined,
  };
}
