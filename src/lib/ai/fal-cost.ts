/**
 * Fal.ai Cost Calculation
 * Computes actual cost using live pricing from fal's Platform API
 * combined with actual output quantities from generation results.
 *
 * The pricing API returns varied units (seconds, minutes, images, megapixels,
 * compute seconds, units, "1m tokens", etc.). Callers pass quantity in their
 * natural unit:
 *   - Video/audio duration: seconds
 *   - Images: image count
 *   - Megapixel-priced images: megapixels
 *
 * For convertible units: normalizes the caller's quantity to match the API's
 * unit, then multiplies by unit_price.
 *
 * For opaque units (e.g. "1m tokens", "compute seconds"): falls back to
 * fal's historical per-call cost estimate API. We can't compute these
 * client-side (compute seconds = GPU inference time, not wall-clock time).
 */

import {
  getFalHistoricalCostPerCall,
  getFalUnitPrice,
} from '@/lib/ai/fal-pricing';

type CallerUnit = 'seconds' | 'images' | 'megapixels';

/**
 * Try to normalize a caller-provided quantity to match the pricing API's unit.
 * Returns undefined if the units are incompatible (e.g. "1m tokens", "compute seconds").
 */
function tryNormalizeQuantity(
  quantity: number,
  callerUnit: CallerUnit,
  apiUnit: string
): number | undefined {
  const unit = apiUnit.toLowerCase();

  // Direct matches
  if (callerUnit === 'seconds' && unit === 'seconds') return quantity;
  if (callerUnit === 'images' && (unit === 'images' || unit === 'units'))
    return quantity;
  if (callerUnit === 'megapixels' && unit === 'megapixels') return quantity;

  // Conversions
  if (callerUnit === 'seconds' && unit === 'minutes') return quantity / 60;

  // Incompatible — caller can't compute this
  return undefined;
}

/**
 * Get the estimated cost for a single fal.ai API call using historical pricing.
 * Used for models where we can't compute cost from quantity (compute_seconds,
 * token-based billing, etc.).
 */
export async function calculateFalCostPerCall(
  endpointId: string,
  falApiKey?: string
): Promise<number> {
  return getFalHistoricalCostPerCall(endpointId, falApiKey);
}

/**
 * Calculate the actual cost for a fal.ai generation.
 *
 * For models with convertible units: cost = unit_price × normalized_quantity
 * For models with opaque units (e.g. "1m tokens"): uses fal's historical
 * per-call cost estimate.
 *
 * @param endpointId - The fal model endpoint (e.g. "fal-ai/flux/dev")
 * @param quantity - The billable quantity in the caller's natural unit
 * @param callerUnit - What the quantity represents
 * @param falApiKey - Optional override API key
 * @returns Cost in USD
 */
export async function calculateFalCost(
  endpointId: string,
  quantity: number,
  callerUnit: CallerUnit,
  falApiKey?: string
): Promise<number> {
  const { unitPrice, unit } = await getFalUnitPrice(endpointId, falApiKey);
  const normalizedQuantity = tryNormalizeQuantity(quantity, callerUnit, unit);

  if (normalizedQuantity !== undefined) {
    return unitPrice * normalizedQuantity;
  }

  // Opaque unit — fall back to historical per-call estimate
  console.log(
    `[fal-cost] Cannot convert "${callerUnit}" to "${unit}" for ${endpointId}, using historical estimate`
  );
  return getFalHistoricalCostPerCall(endpointId, falApiKey);
}
