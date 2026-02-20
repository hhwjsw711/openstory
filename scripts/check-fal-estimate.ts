/**
 * Check per-call cost estimates from fal's historical pricing
 * Uses the Estimate Cost API (POST /v1/models/pricing/estimate)
 *
 * Note: the --individual flag hits the API once per model and may get rate-limited.
 *
 * Usage:
 *   bun scripts/check-fal-estimate.ts              # Total estimate
 *   bun scripts/check-fal-estimate.ts --individual  # Per-model breakdown
 */
import {
  AUDIO_MODELS,
  IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
} from '@/lib/ai/models';
import { getEnv } from '#env';

// Collect all fal endpoint IDs from our model configs
const videoEndpoints = Object.values(IMAGE_TO_VIDEO_MODELS).map((m) => m.id);
const imageEndpoints = Object.values(IMAGE_MODELS)
  .map((m) => m.id)
  .filter((id) => id !== 'letzai/image');
const audioEndpoints = Object.values(AUDIO_MODELS).map((m) => m.id);
const editEndpoints = ['fal-ai/nano-banana-pro/edit'];

const allIds = [
  ...new Set([
    ...videoEndpoints,
    ...imageEndpoints,
    ...editEndpoints,
    ...audioEndpoints,
  ]),
];

const apiKey = getEnv().FAL_KEY;
if (!apiKey) {
  console.error('FAL_KEY not set');
  process.exit(1);
}

// Batch all in one request to avoid rate limits
const endpoints: Record<string, { call_quantity: number }> = {};
for (const id of allIds) {
  endpoints[id] = { call_quantity: 1 };
}

const response = await fetch('https://api.fal.ai/v1/models/pricing/estimate', {
  method: 'POST',
  headers: {
    Authorization: `Key ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    estimate_type: 'historical_api_price',
    endpoints,
  }),
});

if (!response.ok) {
  console.error(`HTTP ${response.status}: ${await response.text()}`);
  process.exit(1);
}

const estimate: {
  estimate_type: string;
  total_cost: number;
  currency: string;
} = await response.json();

console.log(
  `\nTotal estimate (1 call each, ${allIds.length} models): $${estimate.total_cost} ${estimate.currency}`
);
console.log(
  `Average per model: $${(estimate.total_cost / allIds.length).toFixed(4)}`
);

// Individual estimates (one request per model to get per-model breakdown)
// WARNING: will hit rate limits if you have many models. Use sparingly.
if (process.argv.includes('--individual')) {
  console.log('\nPer-model estimates (1 call each):');
  for (const id of allIds) {
    const resp = await fetch('https://api.fal.ai/v1/models/pricing/estimate', {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        estimate_type: 'historical_api_price',
        endpoints: { [id]: { call_quantity: 1 } },
      }),
    });
    if (resp.ok) {
      const data: { total_cost: number; currency: string } = await resp.json();
      console.log(`  ${id}: $${data.total_cost} ${data.currency}`);
    } else {
      console.log(`  ${id}: ERROR ${resp.status} (rate limited?)`);
      break;
    }
    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 200));
  }
}
