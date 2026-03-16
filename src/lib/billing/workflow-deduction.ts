/**
 * Workflow Credit Deduction
 * Shared utility for deducting credits after AI generation in workflows.
 * Skips deduction if team used their own API key (BYOK).
 * Warns and skips (rather than throwing) if credits are insufficient,
 * since the work has already been completed at this point.
 *
 * All monetary values are in Microdollars.
 */

import { createScopedDb } from '@/lib/db/scoped';
import { type Microdollars, microsToUsd, ZERO_MICROS } from './money';

type WorkflowDeductionOpts = {
  /** Team to deduct from. Skips deduction if undefined (e.g., anonymous workflows). */
  teamId: string | undefined;
  costMicros: Microdollars;
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
 * - Skips if costMicros <= 0
 * - Skips if the team used their own API key (usedOwnKey = true)
 * - Warns and skips if the team has insufficient credits (work already done)
 */
export async function deductWorkflowCredits(
  opts: WorkflowDeductionOpts
): Promise<void> {
  if (!opts.teamId || opts.costMicros <= 0 || opts.usedOwnKey) return;

  const scopedDb = createScopedDb(opts.teamId);
  const canAfford = await scopedDb.billing.hasEnoughCredits(opts.costMicros);
  if (!canAfford) {
    const prefix = opts.workflowName ? `[${opts.workflowName}]` : '[Workflow]';
    console.warn(
      `${prefix} Insufficient credits for team ${opts.teamId} (cost: $${microsToUsd(opts.costMicros).toFixed(4)}), skipping deduction`
    );
    // Still attempt auto-top-up so balance can recover
    void scopedDb.billing.checkAutoTopUp().catch((err) => {
      console.error('[AutoTopUp] Failed:', err);
    });
    return;
  }

  await scopedDb.billing.deductCredits(opts.costMicros, {
    userId: opts.userId ?? null,
    description: opts.description,
    metadata: opts.metadata,
  });
}

/**
 * Extract the cost from a fal.ai generation result's metadata.
 * Returns ZERO_MICROS if missing. Cost is already in Microdollars
 * from calculateImageCost/calculateVideoCost/calculateAudioCost.
 */
export function extractImageCost(metadata: {
  cost?: Microdollars;
}): Microdollars {
  return metadata.cost ?? ZERO_MICROS;
}
