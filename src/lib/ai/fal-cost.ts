/**
 * Type-safe fal.ai cost calculation with per-output-type pricing.
 *
 * Three domain-specific functions accept real generation parameters
 * instead of generic quantity/unit pairs.
 */

import {
  IMAGE_PRICING,
  VIDEO_PRICING,
  AUDIO_PRICING,
  type VideoPricing,
} from '@/lib/ai/fal-pricing-data';

/** Default compute time estimate for compute_seconds-priced models */
const DEFAULT_COMPUTE_SECONDS = 3;

// ============================================================================
// Image Cost
// ============================================================================

export type ImageCostParams = {
  endpointId: string;
  numImages: number;
  widthPx?: number;
  heightPx?: number;
  resolution?: '0.5K' | '1K' | '2K' | '4K';
  style?: string;
  quality?: string;
  imageSize?: string;
};

export function calculateImageCost(params: ImageCostParams): number {
  const pricing = IMAGE_PRICING[params.endpointId];
  if (!pricing) {
    warnMissing('image', params.endpointId);
    return 0;
  }

  // Quality/size matrix (e.g. GPT Image 1.5)
  if (pricing.qualitySizeMatrix && params.quality && params.imageSize) {
    const qualityPrices = pricing.qualitySizeMatrix[params.quality];
    if (qualityPrices) {
      const price = qualityPrices[params.imageSize];
      if (price !== undefined) {
        return price * params.numImages;
      }
    }
    // Fall through to base price if matrix doesn't match
  }

  if (pricing.unit === 'per_megapixel') {
    const w = params.widthPx ?? 1024;
    const h = params.heightPx ?? 1024;
    return pricing.basePrice * ((w * h) / 1_000_000) * params.numImages;
  }

  if (pricing.unit === 'per_compute_second') {
    return pricing.basePrice * DEFAULT_COMPUTE_SECONDS * params.numImages;
  }

  // per_image
  let cost = pricing.basePrice * params.numImages;

  // Apply resolution multiplier
  if (pricing.resolutionMultipliers && params.resolution) {
    const mult = pricing.resolutionMultipliers[params.resolution];
    if (mult !== undefined) {
      cost = cost * mult;
    }
  }

  // Apply style multiplier
  if (pricing.styleMultipliers && params.style) {
    const mult = pricing.styleMultipliers[params.style];
    if (mult !== undefined) {
      cost = cost * mult;
    }
  }

  return cost;
}

// ============================================================================
// Video Cost
// ============================================================================

export type VideoCostParams = {
  endpointId: string;
  durationSeconds: number;
  audioEnabled?: boolean;
  voiceControl?: boolean;
  resolution?: string;
  widthPx?: number;
  heightPx?: number;
  fps?: number;
};

export function calculateVideoCost(params: VideoCostParams): number {
  const pricing = VIDEO_PRICING[params.endpointId];
  if (!pricing) {
    warnMissing('video', params.endpointId);
    return 0;
  }

  if (pricing.mode === 'per_token') {
    return calculateTokenBasedVideoCost(pricing, params);
  }

  return calculateSecondBasedVideoCost(pricing, params);
}

function calculateTokenBasedVideoCost(
  pricing: Extract<VideoPricing, { mode: 'per_token' }>,
  params: VideoCostParams
): number {
  const w = params.widthPx ?? 1920;
  const h = params.heightPx ?? 1080;
  const fps = params.fps ?? 24;
  const tokens = (w * h * fps * params.durationSeconds) / 1024;
  return pricing.pricePerMillionTokens * (tokens / 1_000_000);
}

function calculateSecondBasedVideoCost(
  pricing: Extract<VideoPricing, { mode: 'per_second' }>,
  params: VideoCostParams
): number {
  let rate = pricing.basePrice;

  // Resolution+audio matrix (e.g. Veo 3.1)
  if (pricing.resolutionAudioPricing && params.resolution) {
    const resPricing = pricing.resolutionAudioPricing[params.resolution];
    if (resPricing) {
      rate = params.audioEnabled ? resPricing.withAudio : resPricing.noAudio;
      return (
        rate * params.durationSeconds + (pricing.surcharges?.imageInput ?? 0)
      );
    }
  }

  // Resolution-only pricing (e.g. Wan Flash, Grok Video)
  if (pricing.resolutionPricing && params.resolution) {
    const resRate = pricing.resolutionPricing[params.resolution];
    if (resRate !== undefined) {
      rate = resRate;
    }
  }

  // Audio/voice multipliers (e.g. Kling v3 Pro, Veo3)
  if (params.voiceControl && pricing.voiceControlMultiplier) {
    rate = pricing.basePrice * pricing.voiceControlMultiplier;
  } else if (params.audioEnabled && pricing.audioMultiplier) {
    rate = pricing.basePrice * pricing.audioMultiplier;
  }

  let cost = rate * params.durationSeconds;

  // Image input surcharge (e.g. Grok Video)
  if (pricing.surcharges?.imageInput) {
    cost += pricing.surcharges.imageInput;
  }

  return cost;
}

// ============================================================================
// Audio Cost
// ============================================================================

export type AudioCostParams = {
  endpointId: string;
  durationSeconds: number;
};

export function calculateAudioCost(params: AudioCostParams): number {
  const pricing = AUDIO_PRICING[params.endpointId];
  if (!pricing) {
    warnMissing('audio', params.endpointId);
    return 0;
  }

  if (pricing.roundUpToMinute) {
    return pricing.basePrice * Math.ceil(params.durationSeconds / 60);
  }

  if (pricing.unit === 'per_second') {
    return pricing.basePrice * params.durationSeconds;
  }

  if (pricing.unit === 'per_minute') {
    return pricing.basePrice * (params.durationSeconds / 60);
  }

  // per_compute_second
  return pricing.basePrice * DEFAULT_COMPUTE_SECONDS;
}

// ============================================================================
// Helpers
// ============================================================================

function warnMissing(type: string, endpointId: string): void {
  console.warn(
    `[fal-cost] No ${type} pricing data for endpoint: ${endpointId}, returning 0`
  );
}
