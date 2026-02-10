/**
 * Workflow Credit Deduction
 * Shared utility for deducting credits after AI generation in workflows.
 * Skips deduction if team used their own API key (BYOK).
 * Warns and skips (rather than throwing) if credits are insufficient,
 * since the work has already been completed at this point.
 */

import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';

type WorkflowDeductionOpts = {
  /** Team to deduct from. Skips deduction if undefined (e.g., anonymous workflows). */
  teamId: string | undefined;
  costUsd: number;
  /** Set to true if the team used their own API key for this generation */
  usedOwnKey: boolean;
  userId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  /** Workflow name for the console.warn prefix (e.g., "VariantWorkflow") */
  workflowName?: string;
};

/**
 * Deduct credits for a completed workflow generation.
 *
 * - Skips if teamId is undefined
 * - Skips if costUsd <= 0
 * - Skips if the team used their own API key (usedOwnKey = true)
 * - Warns and skips if the team has insufficient credits (work already done)
 */
export async function deductWorkflowCredits(
  opts: WorkflowDeductionOpts
): Promise<void> {
  if (!opts.teamId || opts.costUsd <= 0 || opts.usedOwnKey) return;

  const canAfford = await hasEnoughCredits(opts.teamId, opts.costUsd);
  if (!canAfford) {
    const prefix = opts.workflowName ? `[${opts.workflowName}]` : '[Workflow]';
    console.warn(
      `${prefix} Insufficient credits for team ${opts.teamId} (cost: $${opts.costUsd.toFixed(4)}), skipping deduction`
    );
    return;
  }

  await deductCredits(opts.teamId, opts.costUsd, {
    userId: opts.userId ?? null,
    description: opts.description,
    metadata: opts.metadata,
  });
}

/**
 * Extract the numeric cost from a fal.ai image generation result's metadata.
 * Returns 0 if the cost field is missing or not a number.
 */
export function extractImageCost(metadata: { cost?: unknown }): number {
  return typeof metadata.cost === 'number' ? metadata.cost : 0;
}
