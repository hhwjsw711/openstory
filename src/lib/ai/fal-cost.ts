/**
 * Fal.ai cost calculation using locally-cached pricing data.
 *
 * Callers pass quantity in natural units (seconds, images, megapixels).
 * Normalizes to the pricing data's unit, then unit_price × quantity.
 * Returns 0 with a warning for unknown endpoints.
 */

import { FAL_PRICING } from '@/lib/ai/fal-pricing-data';

type CallerUnit = 'seconds' | 'images' | 'megapixels';

/** Default compute time estimate for compute_seconds-priced models */
const DEFAULT_COMPUTE_SECONDS = 3;

/** Look up pricing for a fal endpoint ID. */
export function getEndpointPricing(
  endpointId: string
): { unitPrice: number; unit: string; pricingNotes?: string } | undefined {
  return FAL_PRICING[endpointId];
}

/** Normalize caller quantity to the pricing data's unit. Returns undefined if incompatible. */
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
  if (unit === 'compute seconds') return DEFAULT_COMPUTE_SECONDS * quantity;

  return undefined;
}

/** Calculate cost for a fal.ai generation in USD (synchronous). */
export function calculateFalCost(
  endpointId: string,
  quantity: number,
  callerUnit: CallerUnit
): number {
  const pricing = getEndpointPricing(endpointId);

  if (!pricing) {
    console.warn(
      `[fal-cost] No pricing data for endpoint: ${endpointId}, returning 0`
    );
    return 0;
  }

  const normalized = normalizeQuantity(quantity, callerUnit, pricing.unit);

  if (normalized !== undefined) {
    return pricing.unitPrice * normalized;
  }

  console.warn(
    `[fal-cost] Cannot convert "${callerUnit}" to "${pricing.unit}" for ${endpointId}, returning 0`
  );
  return 0;
}
