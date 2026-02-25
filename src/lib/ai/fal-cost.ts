/**
 * Fal.ai cost calculation using live pricing from fal's Platform API.
 *
 * Callers pass quantity in natural units (seconds, images, megapixels).
 * For convertible units: normalizes to the API's unit, then unit_price x quantity.
 * For opaque units ("1m tokens", "compute seconds"): falls back to fal's
 * historical per-call cost estimate (can't compute client-side).
 */

import {
  getFalHistoricalCostPerCall,
  getFalUnitPrice,
} from '@/lib/ai/fal-pricing';

type CallerUnit = 'seconds' | 'images' | 'megapixels';

/** Normalize caller quantity to the pricing API's unit. Returns undefined if incompatible. */
function normalizeQuantity(
  quantity: number,
  callerUnit: CallerUnit,
  apiUnit: string
): number | undefined {
  const unit = apiUnit.toLowerCase();

  if (callerUnit === 'seconds' && unit === 'seconds') return quantity;
  if (callerUnit === 'seconds' && unit === 'minutes') return quantity / 60;
  if (callerUnit === 'images' && (unit === 'images' || unit === 'units'))
    return quantity;
  if (callerUnit === 'megapixels' && unit === 'megapixels') return quantity;

  return undefined;
}

/** Calculate cost for a fal.ai generation in USD. */
export async function calculateFalCost(
  endpointId: string,
  quantity: number,
  callerUnit: CallerUnit,
  falApiKey?: string
): Promise<number> {
  const { unitPrice, unit } = await getFalUnitPrice(endpointId, falApiKey);
  const normalized = normalizeQuantity(quantity, callerUnit, unit);

  if (normalized !== undefined) {
    return unitPrice * normalized;
  }

  console.log(
    `[fal-cost] Cannot convert "${callerUnit}" to "${unit}" for ${endpointId}, using historical estimate`
  );
  return getFalHistoricalCostPerCall(endpointId, falApiKey);
}
