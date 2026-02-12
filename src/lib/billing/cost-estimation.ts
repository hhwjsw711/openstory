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

/** Average scene count for a typical script (used when we can't know in advance) */
const DEFAULT_ESTIMATED_SCENE_COUNT = 8;

/**
 * Estimate the total cost of a storyboard workflow.
 * Includes: LLM analysis, character/location sheet images, per-frame images,
 * and optionally per-frame motion generation.
 */
export function estimateStoryboardCost(opts: {
  imageModel: TextToImageModel;
  aspectRatio: AspectRatio;
  estimatedSceneCount?: number;
  autoGenerateMotion?: boolean;
  videoModel?: ImageToVideoModel;
  videoDurationSeconds?: number;
}): number {
  const sceneCount = opts.estimatedSceneCount ?? DEFAULT_ESTIMATED_SCENE_COUNT;

  // LLM calls: script analysis + character bible + location bible (~3 calls)
  const llmCost = estimateLLMCost(3);

  // Character sheets (~3 characters on average, landscape_16_9)
  const characterSheetCost = estimateImageCost(opts.imageModel, '16:9', 3);

  // Location sheets (~3 locations on average, landscape_16_9)
  const locationSheetCost = estimateImageCost(opts.imageModel, '16:9', 3);

  // Per-frame images
  const frameCost = estimateImageCost(
    opts.imageModel,
    opts.aspectRatio,
    sceneCount
  );

  let totalCost = llmCost + characterSheetCost + locationSheetCost + frameCost;

  // Optional motion generation for all frames
  if (opts.autoGenerateMotion && opts.videoModel) {
    const duration = opts.videoDurationSeconds ?? 5;
    totalCost += estimateVideoCost(opts.videoModel, duration) * sceneCount;
  }

  return totalCost;
}
