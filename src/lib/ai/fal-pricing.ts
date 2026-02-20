/**
 * Fal.ai Pricing API Client
 * Fetches live unit prices from fal's Platform API.
 *
 * No caching — runs serverless so in-memory state doesn't persist.
 * The ~100ms fetch is negligible vs generation times (5-60s+).
 *
 * API: GET https://api.fal.ai/v1/models/pricing?endpoint_id=...
 * Docs: https://docs.fal.ai/platform-apis/v1/models/pricing
 */

import { getEnv } from '#env';

type FalPriceEntry = {
  endpoint_id: string;
  unit_price: number;
  unit: string;
  currency: string;
};

type FalPricingResponse = {
  prices: FalPriceEntry[];
  next_cursor: string | null;
  has_more: boolean;
};

/**
 * Fetch unit price for a fal.ai endpoint from the Platform Pricing API.
 *
 * @param endpointId - The fal model endpoint (e.g. "fal-ai/flux/dev")
 * @param falApiKey - Optional override API key
 * @returns The unit price in USD
 */
export async function getFalUnitPrice(
  endpointId: string,
  falApiKey?: string
): Promise<{ unitPrice: number; unit: string }> {
  const apiKey = falApiKey ?? getEnv().FAL_KEY;
  if (!apiKey) {
    throw new Error('FAL_KEY is required to fetch pricing');
  }

  const url = new URL('https://api.fal.ai/v1/models/pricing');
  url.searchParams.set('endpoint_id', endpointId);

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Key ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch fal pricing for ${endpointId}: ${response.status} ${response.statusText}`
    );
  }

  const data: FalPricingResponse = await response.json();
  const entry = data.prices.find((p) => p.endpoint_id === endpointId);

  if (!entry) {
    throw new Error(
      `No pricing found for endpoint: ${endpointId}. Response contained ${data.prices.length} entries.`
    );
  }

  return { unitPrice: entry.unit_price, unit: entry.unit };
}

/**
 * Get the estimated cost for a single API call using fal's historical pricing.
 * Used for models with opaque billing units (e.g. "1m tokens") where we can't
 * compute cost from unit_price × quantity on our side.
 *
 * POST https://api.fal.ai/v1/models/pricing/estimate
 */
export async function getFalHistoricalCostPerCall(
  endpointId: string,
  falApiKey?: string
): Promise<number> {
  const apiKey = falApiKey ?? getEnv().FAL_KEY;
  if (!apiKey) {
    throw new Error('FAL_KEY is required to fetch pricing estimate');
  }

  const response = await fetch(
    'https://api.fal.ai/v1/models/pricing/estimate',
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        estimate_type: 'historical_api_price',
        endpoints: { [endpointId]: { call_quantity: 1 } },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch fal cost estimate for ${endpointId}: ${response.status} ${response.statusText}`
    );
  }

  const data: { total_cost: number; currency: string } = await response.json();

  return data.total_cost;
}
