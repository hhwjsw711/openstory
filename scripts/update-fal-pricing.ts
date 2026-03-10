/**
 * Fetch live pricing from fal.ai and write src/lib/ai/fal-pricing-data.ts
 * Usage:
 *   bun scripts/update-fal-pricing.ts            # API pricing only
 *   bun scripts/update-fal-pricing.ts --llms-txt  # Also fetch llms.txt pricing notes
 */
import { getEnv } from '#env';
import {
  AUDIO_MODELS,
  IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
} from '@/lib/ai/models';
import type {
  ImagePricing,
  VideoPricing,
  AudioPricing,
} from '@/lib/ai/fal-pricing-data';
import { getFalEndpointIds } from './fal-endpoints';

const fetchLlmsTxt = process.argv.includes('--llms-txt');

const apiKey = getEnv().FAL_KEY;
if (!apiKey) {
  console.error('FAL_KEY not set');
  process.exit(1);
}

const endpoints = getFalEndpointIds();

// ============================================================================
// Classify endpoints into image/video/audio
// ============================================================================

const imageEndpointIds = new Set<string>(
  Object.values(IMAGE_MODELS)
    .map((m) => m.id)
    .filter((id) => id !== 'letzai/image')
);
// Include edit endpoints
imageEndpointIds.add('fal-ai/nano-banana-pro/edit');

const videoEndpointIds = new Set<string>(
  Object.values(IMAGE_TO_VIDEO_MODELS).map((m) => m.id)
);

const audioEndpointIds = new Set<string>(
  Object.values(AUDIO_MODELS).map((m) => m.id)
);

function classifyEndpoint(id: string): 'image' | 'video' | 'audio' | 'unknown' {
  if (imageEndpointIds.has(id)) return 'image';
  if (videoEndpointIds.has(id)) return 'video';
  if (audioEndpointIds.has(id)) return 'audio';
  return 'unknown';
}

// ============================================================================
// Manual overrides — conditional pricing that can't be auto-derived from API
// ============================================================================

const IMAGE_OVERRIDES: Record<string, Partial<ImagePricing>> = {
  'fal-ai/nano-banana-2': {
    resolutionMultipliers: { '0.5K': 0.75, '1K': 1, '2K': 1, '4K': 2 },
    surcharges: { webSearch: 0.015 },
  },
  'fal-ai/nano-banana-pro': {
    resolutionMultipliers: { '4K': 2 },
    surcharges: { webSearch: 0.015 },
  },
  'fal-ai/nano-banana-pro/edit': {
    resolutionMultipliers: { '4K': 2 },
    surcharges: { webSearch: 0.015 },
  },
  'fal-ai/recraft/v3/text-to-image': {
    styleMultipliers: { vector_illustration: 2, vector: 2 },
  },
  'fal-ai/gpt-image-1.5': {
    basePrice: 0, // Overridden by matrix
    qualitySizeMatrix: {
      // Prices from llms.txt + ~$0.01 buffer for prompt token processing costs
      low: { '1024x1024': 0.02, '1024x1536': 0.025, '1536x1024': 0.025 },
      medium: {
        '1024x1024': 0.045,
        '1024x1536': 0.062,
        '1536x1024': 0.061,
      },
      high: {
        '1024x1024': 0.144,
        '1024x1536': 0.211,
        '1536x1024': 0.21,
      },
    },
  },
};

type VideoOverride =
  | Partial<Extract<VideoPricing, { mode: 'per_second' }>>
  | { mode: 'per_token'; pricePerMillionTokens?: number };

const VIDEO_OVERRIDES: Record<string, VideoOverride> = {
  'fal-ai/veo3': {
    // API returns audio-on rate ($0.40); no multiplier needed
  },
  'fal-ai/veo3.1/image-to-video': {
    resolutionAudioPricing: {
      '720p': { noAudio: 0.2, withAudio: 0.4 },
      '1080p': { noAudio: 0.2, withAudio: 0.4 },
      '4K': { noAudio: 0.4, withAudio: 0.6 },
    },
  },
  'fal-ai/kling-video/v3/pro/image-to-video': {
    noAudioMultiplier: 0.8,
    audioMultiplier: 1.2,
    voiceControlMultiplier: 1.4,
  },
  'wan/v2.6/image-to-video/flash': {
    resolutionPricing: { '720p': 0.05, '1080p': 0.075 },
  },
  'xai/grok-imagine-video/image-to-video': {
    resolutionPricing: { '480p': 0.05, '720p': 0.07 },
    surcharges: { imageInput: 0.002 },
  },
  'fal-ai/bytedance/seedance/v1/pro/image-to-video': {
    mode: 'per_token',
  },
};

const AUDIO_OVERRIDES: Record<string, Partial<AudioPricing>> = {
  'fal-ai/elevenlabs/music': {
    roundUpToMinute: true,
  },
};

// ============================================================================
// Fetch pricing from API
// ============================================================================

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

// ============================================================================
// Read existing file for diff and pricingNotes preservation
// ============================================================================

const outPath = new URL('../src/lib/ai/fal-pricing-data.ts', import.meta.url)
  .pathname;

let oldImagePricing: Record<string, ImagePricing> = {};
let oldVideoPricing: Record<string, VideoPricing> = {};
let oldAudioPricing: Record<string, AudioPricing> = {};
try {
  const existing = await import(outPath);
  oldImagePricing = existing.IMAGE_PRICING ?? {};
  oldVideoPricing = existing.VIDEO_PRICING ?? {};
  oldAudioPricing = existing.AUDIO_PRICING ?? {};
} catch {
  // First run — no existing file
}

// ============================================================================
// Build typed pricing maps
// ============================================================================

const imagePricing: Record<string, ImagePricing> = {};
const videoPricing: Record<string, VideoPricing> = {};
const audioPricing: Record<string, AudioPricing> = {};

function mapImageUnit(
  apiUnit: string
): 'per_image' | 'per_megapixel' | 'per_compute_second' {
  const u = apiUnit.toLowerCase();
  if (u === 'megapixels') return 'per_megapixel';
  if (u === 'compute seconds') return 'per_compute_second';
  return 'per_image';
}

function mapAudioUnit(
  apiUnit: string
): 'per_second' | 'per_minute' | 'per_compute_second' {
  const u = apiUnit.toLowerCase();
  if (u === 'minutes') return 'per_minute';
  if (u === 'compute seconds') return 'per_compute_second';
  return 'per_second';
}

for (const p of data.prices.sort((a, b) =>
  a.endpoint_id.localeCompare(b.endpoint_id)
)) {
  const type = classifyEndpoint(p.endpoint_id);

  switch (type) {
    case 'image': {
      const override = IMAGE_OVERRIDES[p.endpoint_id];
      imagePricing[p.endpoint_id] = {
        basePrice: override?.basePrice ?? p.unit_price,
        unit: mapImageUnit(p.unit),
        ...override,
      };
      break;
    }
    case 'video': {
      const override = VIDEO_OVERRIDES[p.endpoint_id];
      if (override && 'mode' in override && override.mode === 'per_token') {
        videoPricing[p.endpoint_id] = {
          mode: 'per_token',
          pricePerMillionTokens: override.pricePerMillionTokens ?? p.unit_price,
        };
      } else {
        const secOverride = override as
          | Partial<Extract<VideoPricing, { mode: 'per_second' }>>
          | undefined;
        videoPricing[p.endpoint_id] = {
          mode: 'per_second',
          basePrice: secOverride?.basePrice ?? p.unit_price,
          ...secOverride,
        };
      }
      break;
    }
    case 'audio': {
      const override = AUDIO_OVERRIDES[p.endpoint_id];
      audioPricing[p.endpoint_id] = {
        basePrice: p.unit_price,
        unit: mapAudioUnit(p.unit),
        ...override,
      };
      break;
    }
    default:
      console.warn(`  ? ${p.endpoint_id}: unclassified, skipping`);
  }
}

// ============================================================================
// Fetch llms.txt pricing notes
// ============================================================================

const allPricing = new Map<string, { pricingNotes?: string }>();
for (const [id, p] of Object.entries(imagePricing)) allPricing.set(id, p);
for (const [id, p] of Object.entries(videoPricing)) allPricing.set(id, p);
for (const [id, p] of Object.entries(audioPricing)) allPricing.set(id, p);

if (fetchLlmsTxt) {
  console.log('\nFetching llms.txt pricing notes...\n');

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
      console.log(`  \u23ED ${id}: no llms.txt`);
      continue;
    }

    const { endpointId, notes } = result.value;

    const pricingMatch = notes.match(
      /## Pricing\s*\n([\s\S]*?)(?=\n## |\n# |$)/
    );
    if (!pricingMatch) {
      console.log(`  \u23ED ${endpointId}: no pricing section`);
      continue;
    }

    const pricingText = pricingMatch[1].trim();
    console.log(`  \u2713 ${endpointId}:`);
    console.log(`    ${pricingText.split('\n').join('\n    ')}\n`);

    const entry = allPricing.get(endpointId);
    if (entry) {
      entry.pricingNotes = pricingText;
    }
  }
}

// Preserve existing pricingNotes when not fetching llms.txt
if (!fetchLlmsTxt) {
  for (const [id, entry] of Object.entries(imagePricing)) {
    const old = oldImagePricing[id];
    if (old?.pricingNotes && !entry.pricingNotes) {
      entry.pricingNotes = old.pricingNotes;
    }
  }
  for (const [id, entry] of Object.entries(videoPricing)) {
    const old = oldVideoPricing[id];
    if (old?.pricingNotes && !entry.pricingNotes) {
      entry.pricingNotes = old.pricingNotes;
    }
  }
  for (const [id, entry] of Object.entries(audioPricing)) {
    const old = oldAudioPricing[id];
    if (old?.pricingNotes && !entry.pricingNotes) {
      entry.pricingNotes = old.pricingNotes;
    }
  }
}

// ============================================================================
// Log diff summary
// ============================================================================

let changes = 0;

function getBasePrice(entry: Record<string, unknown>): number {
  if (typeof entry.basePrice === 'number') return entry.basePrice;
  if (typeof entry.pricePerMillionTokens === 'number')
    return entry.pricePerMillionTokens;
  return 0;
}

function diffMap(
  label: string,
  newIds: string[],
  oldIds: string[],
  getNew: (id: string) => Record<string, unknown> | undefined,
  getOld: (id: string) => Record<string, unknown> | undefined
) {
  for (const id of newIds) {
    const entry = getNew(id);
    const old = getOld(id);
    const bp = entry ? getBasePrice(entry) : 0;
    if (!old) {
      console.log(`  + [${label}] ${id}: $${bp} (new)`);
      changes++;
    } else {
      const oldBp = getBasePrice(old);
      if (oldBp !== bp) {
        console.log(`  ~ [${label}] ${id}: $${oldBp} → $${bp}`);
        changes++;
      }
    }
  }
  for (const id of oldIds) {
    if (!getNew(id)) {
      console.log(`  - [${label}] ${id}: removed`);
      changes++;
    }
  }
}

diffMap(
  'image',
  Object.keys(imagePricing),
  Object.keys(oldImagePricing),
  (id) => imagePricing[id],
  (id) => oldImagePricing[id]
);
diffMap(
  'video',
  Object.keys(videoPricing),
  Object.keys(oldVideoPricing),
  (id) => videoPricing[id],
  (id) => oldVideoPricing[id]
);
diffMap(
  'audio',
  Object.keys(audioPricing),
  Object.keys(oldAudioPricing),
  (id) => audioPricing[id],
  (id) => oldAudioPricing[id]
);

// ============================================================================
// Write the generated file
// ============================================================================

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function serializeValue(value: unknown, indent: number): string {
  const pad = '  '.repeat(indent);
  const padInner = '  '.repeat(indent + 1);

  if (value === undefined || value === null) return 'undefined';
  if (typeof value === 'string') return `'${escapeString(value)}'`;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);

  if (Array.isArray(value)) {
    const items = value.map((v) => serializeValue(v, indent + 1));
    return `[${items.join(', ')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    const lines = entries.map(
      ([k, v]) => `${padInner}${quoteKey(k)}: ${serializeValue(v, indent + 1)}`
    );
    return `{\n${lines.join(',\n')},\n${pad}}`;
  }

  return JSON.stringify(value);
}

function quoteKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
}

function serializeMap(
  name: string,
  type: string,
  map: Record<string, unknown>
): string {
  const entries = Object.entries(map)
    .map(([id, p]) => `  '${id}': ${serializeValue(p, 1)},`)
    .join('\n');

  return `export const ${name}: Record<string, ${type}> = {\n${entries}\n};`;
}

const now = new Date().toISOString();
const output = `// AUTO-GENERATED — do not edit manually. Run: bun scripts/update-fal-pricing.ts
// Manual overrides (multipliers, matrices) are maintained in scripts/update-fal-pricing.ts

// ============================================================================
// Image Pricing
// ============================================================================

type ImagePricingUnit = 'per_image' | 'per_megapixel' | 'per_compute_second';

export type ImagePricing = {
  basePrice: number;
  unit: ImagePricingUnit;
  resolutionMultipliers?: Partial<Record<'0.5K' | '1K' | '2K' | '4K', number>>;
  styleMultipliers?: Record<string, number>;
  qualitySizeMatrix?: Record<string, Record<string, number>>;
  surcharges?: { webSearch?: number };
  pricingNotes?: string;
};

${serializeMap('IMAGE_PRICING', 'ImagePricing', imagePricing)}

// ============================================================================
// Video Pricing
// ============================================================================

type VideoPricingBase = { pricingNotes?: string };

type VideoPricingPerSecond = VideoPricingBase & {
  mode: 'per_second';
  basePrice: number;
  noAudioMultiplier?: number;
  audioMultiplier?: number;
  voiceControlMultiplier?: number;
  resolutionPricing?: Record<string, number>;
  resolutionAudioPricing?: Record<string, { noAudio: number; withAudio: number }>;
  surcharges?: { imageInput?: number };
};

type VideoPricingPerToken = VideoPricingBase & {
  mode: 'per_token';
  pricePerMillionTokens: number;
};

export type VideoPricing = VideoPricingPerSecond | VideoPricingPerToken;

${serializeMap('VIDEO_PRICING', 'VideoPricing', videoPricing)}

// ============================================================================
// Audio Pricing
// ============================================================================

type AudioPricingUnit = 'per_second' | 'per_minute' | 'per_compute_second';

export type AudioPricing = {
  basePrice: number;
  unit: AudioPricingUnit;
  roundUpToMinute?: boolean;
  pricingNotes?: string;
};

${serializeMap('AUDIO_PRICING', 'AudioPricing', audioPricing)}

export const PRICING_LAST_UPDATED = '${now}';
`;

await Bun.write(outPath, output);

const total =
  Object.keys(imagePricing).length +
  Object.keys(videoPricing).length +
  Object.keys(audioPricing).length;
console.log(
  `\nWrote ${total} endpoints to fal-pricing-data.ts (${changes} changes)`
);
console.log(
  `  Image: ${Object.keys(imagePricing).length}, Video: ${Object.keys(videoPricing).length}, Audio: ${Object.keys(audioPricing).length}`
);
