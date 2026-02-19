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
