/**
 * Fal.ai Pricing API Client
 *
 * Fetches live unit prices from fal's Platform API.
 * No caching -- runs serverless so in-memory state doesn't persist.
 * The ~100ms fetch is negligible vs generation times (5-60s+).
 *
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

type FalEstimateResponse = {
  total_cost: number;
  currency: string;
};

function resolveApiKey(override?: string): string {
  const apiKey = override ?? getEnv().FAL_KEY;
  if (!apiKey) {
    throw new Error('FAL_KEY is required to fetch fal.ai pricing');
  }
  return apiKey;
}

async function falFetch<T>(
  url: string | URL,
  apiKey: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Key ${apiKey}`);

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Fal pricing API error: ${response.status} ${response.statusText} (${url})`
    );
  }

  return response.json();
}

/**
 * Fetch unit price for a fal.ai endpoint from the Platform Pricing API.
 */
export async function getFalUnitPrice(
  endpointId: string,
  falApiKey?: string
): Promise<{ unitPrice: number; unit: string }> {
  const apiKey = resolveApiKey(falApiKey);

  const url = new URL('https://api.fal.ai/v1/models/pricing');
  url.searchParams.set('endpoint_id', endpointId);

  const data = await falFetch<FalPricingResponse>(url, apiKey);
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
 * compute cost from unit_price x quantity on our side.
 */
export async function getFalHistoricalCostPerCall(
  endpointId: string,
  falApiKey?: string
): Promise<number> {
  const apiKey = resolveApiKey(falApiKey);

  const data = await falFetch<FalEstimateResponse>(
    'https://api.fal.ai/v1/models/pricing/estimate',
    apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estimate_type: 'historical_api_price',
        endpoints: { [endpointId]: { call_quantity: 1 } },
      }),
    }
  );

  return data.total_cost;
}
