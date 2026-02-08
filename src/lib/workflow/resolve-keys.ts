/**
 * Workflow API Key Resolution
 *
 * Resolves team-specific API keys for use in workflow steps.
 * Call this at the beginning of a workflow to get the keys,
 * then pass them through to AI client calls.
 */

import { apiKeyService } from '@/lib/services/api-key.service';

export type ResolvedApiKeys = {
  openRouterApiKey?: string;
  falApiKey?: string;
  /** Whether the team is using their own keys (affects credit deduction) */
  isUsingOwnKeys: {
    openrouter: boolean;
    fal: boolean;
  };
};

/**
 * Resolve API keys for a team's workflow execution.
 * Returns the appropriate keys (team-provided or platform fallback).
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
    return {
      isUsingOwnKeys: { openrouter: false, fal: false },
    };
  }

  const [openrouter, fal] = await Promise.all([
    apiKeyService.resolveKey('openrouter', teamId),
    apiKeyService.resolveKey('fal', teamId),
  ]);

  return {
    openRouterApiKey: openrouter.source === 'team' ? openrouter.key : undefined,
    falApiKey: fal.source === 'team' ? fal.key : undefined,
    isUsingOwnKeys: {
      openrouter: openrouter.source === 'team',
      fal: fal.source === 'team',
    },
  };
}
