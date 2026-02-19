/**
 * Fal.ai Cost Calculation
 * Computes actual cost using live pricing from fal's Platform API
 * combined with actual output quantities from generation results.
 *
 * Formula: cost = unit_price x quantity
 */

import { getFalUnitPrice } from '@/lib/ai/fal-pricing';

/**
 * Calculate the actual cost for a fal.ai generation.
 *
 * @param endpointId - The fal model endpoint (e.g. "fal-ai/flux/dev")
 * @param quantity - The billable quantity (images, seconds, megapixels, etc.)
 * @param falApiKey - Optional override API key
 * @returns Cost in USD
 */
export async function calculateFalCost(
  endpointId: string,
  quantity: number,
  falApiKey?: string
): Promise<number> {
  const { unitPrice } = await getFalUnitPrice(endpointId, falApiKey);
  return unitPrice * quantity;
}
