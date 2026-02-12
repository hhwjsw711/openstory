/**
 * Pre-flight Billing Check
 * Shared utility for server functions to verify credit availability
 * before triggering workflows. Skips check if team has own BYOK keys.
 */

import { hasEnoughCredits } from '@/lib/billing/credit-service';
import { InsufficientCreditsError } from '@/lib/errors';
import { apiKeyService } from '@/lib/services/api-key.service';

type Provider = 'fal' | 'openrouter';

/**
 * Verify a team can afford a generation before triggering it.
 * Skips the check entirely if the team has BYOK keys for all required providers.
 *
 * @param teamId - Team to check
 * @param estimatedCost - Estimated raw cost in USD
 * @param providers - Which BYOK providers bypass the check (default: ['fal'])
 * @param errorMessage - Custom error message for insufficient credits
 *
 * @throws InsufficientCreditsError if team lacks credits and has no BYOK keys
 */
export async function requireCredits(
  teamId: string,
  estimatedCost: number,
  opts: {
    providers?: Provider[];
    errorMessage?: string;
  } = {}
): Promise<void> {
  const providers = opts.providers ?? ['fal'];

  // Check if team has all required BYOK keys (any missing = need credits)
  const keyChecks = await Promise.all(
    providers.map((provider) => apiKeyService.hasKey(teamId, provider))
  );
  const hasAllKeys = keyChecks.every(Boolean);

  if (hasAllKeys) return;

  const canAfford = await hasEnoughCredits(teamId, estimatedCost);
  if (!canAfford) {
    throw new InsufficientCreditsError(
      opts.errorMessage ?? 'Insufficient credits'
    );
  }
}
