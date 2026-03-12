/**
 * Workflow Credit Deduction
 * Shared utility for deducting credits after AI generation in workflows.
 * Skips deduction if team used their own API key (BYOK).
 * Warns and skips (rather than throwing) if credits are insufficient,
 * since the work has already been completed at this point.
 *
 * All monetary values are in Microdollars.
 */

import { isBillingEnabled } from '@/lib/billing/constants';
import {
  checkAutoTopUp,
  deductCredits,
  hasEnoughCredits,
} from '@/lib/billing/credit-service';
import { type Microdollars, micros, microsToUsd, ZERO_MICROS } from './money';

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
  if (
    !isBillingEnabled() ||
    !opts.teamId ||
    opts.costMicros <= 0 ||
    opts.usedOwnKey
  )
    return;

  const canAfford = await hasEnoughCredits(opts.teamId, opts.costMicros);
  if (!canAfford) {
    const prefix = opts.workflowName ? `[${opts.workflowName}]` : '[Workflow]';
    console.warn(
      `${prefix} Insufficient credits for team ${opts.teamId} (cost: $${microsToUsd(opts.costMicros).toFixed(4)}), skipping deduction`
    );
    // Still attempt auto-top-up so balance can recover
    void checkAutoTopUp(opts.teamId).catch((err) => {
      console.error('[AutoTopUp] Failed:', err);
    });
    return;
  }

  await deductCredits(opts.teamId, opts.costMicros, {
    userId: opts.userId ?? null,
    description: opts.description,
    metadata: opts.metadata,
  });
}

/**
 * Extract the numeric cost from image generation result metadata.
 * The cost is already in Microdollars (set by calculateImageCost in fal-cost.ts).
 */
export function extractImageCost(metadata: { cost?: unknown }): Microdollars {
  return typeof metadata.cost === 'number'
    ? micros(metadata.cost)
    : ZERO_MICROS;
}
