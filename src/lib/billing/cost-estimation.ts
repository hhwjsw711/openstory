/**
 * Cost Estimation Utilities
 * Estimate generation costs before triggering workflows
 */

import {
  IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
  type TextToImageModel,
  type ImageToVideoModel,
} from '@/lib/ai/models';
import { aspectRatioToDimensions } from '@/lib/constants/aspect-ratios';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';

/** Default compute time estimate for compute_seconds-priced models */
const DEFAULT_COMPUTE_SECONDS = 3;

/**
 * Estimate the raw cost (before markup) of generating images
 */
export function estimateImageCost(
  model: TextToImageModel,
  aspectRatio: AspectRatio,
  numImages: number
): number {
  const config = IMAGE_MODELS[model];
  if (!config.pricing) return 0;

  const { price, unit } = config.pricing;

  switch (unit) {
    case 'images':
      return price * numImages;
    case 'megapixels': {
      const { width, height } = aspectRatioToDimensions(aspectRatio);
      const megapixels = (width * height) / 1_000_000;
      return price * megapixels * numImages;
    }
    case 'compute_seconds':
      return price * DEFAULT_COMPUTE_SECONDS * numImages;
  }
}

/**
 * Estimate the raw cost (before markup) of generating video
 */
export function estimateVideoCost(
  model: ImageToVideoModel,
  durationSeconds: number
): number {
  const config = IMAGE_TO_VIDEO_MODELS[model];
  return config.pricing.pricePerSecond * durationSeconds;
}

/**
 * Rough estimate of LLM cost per call for pre-flight credit checks.
 * Based on average token usage for script analysis calls.
 * Only used for client-side gate affordability checks, not actual deduction.
 */
const AVERAGE_LLM_COST_PER_CALL_USD = 0.02;

export function estimateLLMCost(numCalls: number = 1): number {
  return AVERAGE_LLM_COST_PER_CALL_USD * numCalls;
}
