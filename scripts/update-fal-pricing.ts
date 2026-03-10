/**
 * Fetch live pricing from fal.ai and write src/lib/ai/fal-pricing-data.ts
 * Usage:
 *   bun scripts/update-fal-pricing.ts            # API pricing only
 *   bun scripts/update-fal-pricing.ts --llms-txt  # Also fetch llms.txt pricing notes
 */
import { getEnv } from '#env';
import { getFalEndpointIds } from './fal-endpoints';

const fetchLlmsTxt = process.argv.includes('--llms-txt');

const apiKey = getEnv().FAL_KEY;
if (!apiKey) {
  console.error('FAL_KEY not set');
  process.exit(1);
}

const endpoints = getFalEndpointIds();

const url = new URL('https://api.fal.ai/v1/models/pricing');
url.searchParams.set('endpoint_id', endpoints.join(','));

const response = await fetch(url.toString(), {
  headers: { Authorization: `Key ${apiKey}` },
});

if (!response.ok) {
  console.error(`HTTP ${response.status}: ${await response.text()}`);
  process.exit(1);
}

type PriceEntry = {
  endpoint_id: string;
  unit_price: number;
  unit: string;
  currency: string;
};

const data: { prices: PriceEntry[] } = await response.json();

// Check for missing endpoints
const found = new Set(data.prices.map((p) => p.endpoint_id));
const missing = endpoints.filter((e) => !found.has(e));
if (missing.length > 0) {
  console.error('\nERROR: Missing endpoints from fal pricing API:');
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

// Read existing file to diff
const outPath = new URL('../src/lib/ai/fal-pricing-data.ts', import.meta.url)
  .pathname;
let oldPrices: Record<
  string,
  { unitPrice: number; unit: string; pricingNotes?: string }
> = {};
try {
  const existing = await import(outPath);
  oldPrices = existing.FAL_PRICING ?? {};
} catch {
  // First run — no existing file
}

// Build pricing map sorted by endpoint ID
const pricing: Record<
  string,
  { unitPrice: number; unit: string; pricingNotes?: string }
> = {};
for (const p of data.prices.sort((a, b) =>
  a.endpoint_id.localeCompare(b.endpoint_id)
)) {
  pricing[p.endpoint_id] = { unitPrice: p.unit_price, unit: p.unit };
}

// Fetch llms.txt pricing notes if requested
if (fetchLlmsTxt) {
  console.log('\nFetching llms.txt pricing notes...\n');

  // Only fetch for fal-hosted endpoints (those with fal.ai model pages)
  const falEndpoints = endpoints.filter(
    (id) =>
      id.startsWith('fal-ai/') ||
      id.startsWith('xai/') ||
      id.startsWith('wan/') ||
      id.startsWith('beatoven/')
  );

  const results = await Promise.allSettled(
    falEndpoints.map(async (endpointId) => {
      const llmsUrl = `https://fal.ai/models/${endpointId}/llms.txt`;
      const res = await fetch(llmsUrl);
      if (!res.ok) return { endpointId, notes: null };
      const text = await res.text();
      return { endpointId, notes: text };
    })
  );

  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value.notes) {
      const id =
        result.status === 'fulfilled' ? result.value.endpointId : 'unknown';
      console.log(`  ⏭ ${id}: no llms.txt`);
      continue;
    }

    const { endpointId, notes } = result.value;

    // Extract ## Pricing section
    const pricingMatch = notes.match(
      /## Pricing\s*\n([\s\S]*?)(?=\n## |\n# |$)/
    );
    if (!pricingMatch) {
      console.log(`  ⏭ ${endpointId}: no pricing section`);
      continue;
    }

    const pricingText = pricingMatch[1].trim();
    console.log(`  ✓ ${endpointId}:`);
    console.log(`    ${pricingText.split('\n').join('\n    ')}\n`);

    if (pricing[endpointId]) {
      pricing[endpointId].pricingNotes = pricingText;
    }
  }
}

// Preserve existing pricingNotes when not fetching llms.txt
if (!fetchLlmsTxt) {
  for (const [id, entry] of Object.entries(pricing)) {
    if (oldPrices[id]?.pricingNotes) {
      entry.pricingNotes = oldPrices[id].pricingNotes;
    }
  }
}

// Log diff summary
let changes = 0;
for (const [id, price] of Object.entries(pricing)) {
  const old = oldPrices[id];
  if (!old) {
    console.log(`  + ${id}: $${price.unitPrice}/${price.unit} (new)`);
    changes++;
  } else if (old.unitPrice !== price.unitPrice || old.unit !== price.unit) {
    console.log(
      `  ~ ${id}: $${old.unitPrice}/${old.unit} → $${price.unitPrice}/${price.unit}`
    );
    changes++;
  }
}
for (const id of Object.keys(oldPrices)) {
  if (!pricing[id]) {
    console.log(`  - ${id}: removed`);
    changes++;
  }
}

// Write the generated file
function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

const entries = Object.entries(pricing)
  .map(([id, p]) => {
    const notes = p.pricingNotes
      ? `, pricingNotes: '${escapeString(p.pricingNotes)}'`
      : '';
    return `  '${id}': { unitPrice: ${p.unitPrice}, unit: '${p.unit}'${notes} },`;
  })
  .join('\n');

const now = new Date().toISOString();
const output = `// AUTO-GENERATED — do not edit manually. Run: bun scripts/update-fal-pricing.ts
export const FAL_PRICING: Record<string, { unitPrice: number; unit: string; pricingNotes?: string }> = {
${entries}
};

export const PRICING_LAST_UPDATED = '${now}';
`;

await Bun.write(outPath, output);

console.log(
  `\nWrote ${Object.keys(pricing).length} endpoints to fal-pricing-data.ts (${changes} changes)`
);
