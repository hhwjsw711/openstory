/**
 * Schema-Driven Model Input Builder
 *
 * Builds the fal.ai request body for a video model using the generated
 * Zod schemas from src/lib/motion/generated/. The Zod schemas provide
 * runtime validation and proper TypeScript types — no casts needed.
 */

import type {
  ImageToVideoModel,
  ImageToVideoModelConfig,
} from '@/lib/ai/models';
import {
  MOTION_INPUT_SCHEMAS,
  type MotionEndpointId,
} from './generated/endpoint-map';
import { snapDuration } from './motion-generation';
import type { GenerateMotionOptions } from './motion-generation';

// -- Quality overrides (keyed by model key, not endpoint ID) ------------------

/** Intentional deviations from API defaults */
const QUALITY_OVERRIDES: Partial<
  Record<ImageToVideoModel, Record<string, unknown>>
> = {
  veo3: { resolution: '1080p' },
  veo3_1: { resolution: '1080p' },
  seedance_v1_pro: { resolution: '1080p' },
};

// -- Duration formatting ------------------------------------------------------

/**
 * Format duration for the target model based on what the API expects.
 * Kling/Seedance/Wan: string enum ("5", "10")
 * Veo: string with suffix ("4s", "8s")
 * Sora/Grok: integer
 */
function formatDuration(
  requested: number | undefined,
  modelConfig: ImageToVideoModelConfig
): string | number {
  const snapped = snapDuration(requested, modelConfig.capabilities);

  // Models with requiresStringDuration or string-typed duration enums
  // We check capabilities since the model config already tracks this
  if (
    'requiresStringDuration' in modelConfig.capabilities &&
    modelConfig.capabilities.requiresStringDuration
  ) {
    return String(Math.round(snapped));
  }

  // Veo models use "Ns" format
  if (modelConfig.provider === 'google') {
    return `${snapped}s`;
  }

  // Seedance and Wan use string durations
  if (modelConfig.provider === 'seedance' || modelConfig.provider === 'wan') {
    return String(Math.round(snapped));
  }

  // Sora, Grok use integer
  return Math.round(snapped);
}

// -- Main builder -------------------------------------------------------------

export function buildModelInput(
  options: GenerateMotionOptions,
  modelConfig: ImageToVideoModelConfig,
  modelKey: ImageToVideoModel
) {
  const endpointId = modelConfig.id satisfies MotionEndpointId;
  const zodSchema = MOTION_INPUT_SCHEMAS[endpointId];
  if (!zodSchema) {
    throw new Error(`No schema found for model: ${modelConfig.id}`);
  }

  const overrides = QUALITY_OVERRIDES[modelKey];

  // Build the input object with our values + overrides
  // The Zod schema will validate and fill in defaults
  const raw: Record<string, unknown> = {
    prompt: options.prompt,
    duration: formatDuration(options.duration, modelConfig),
    ...overrides,
  };

  // Set the image URL on the correct property name
  // (image_url for most models, start_image_url for Kling v3/O1)
  if (
    'imageUrlParamName' in modelConfig.capabilities &&
    modelConfig.capabilities.imageUrlParamName
  ) {
    raw[modelConfig.capabilities.imageUrlParamName] = options.imageUrl;
  } else {
    raw.image_url = options.imageUrl;
  }

  if (options.aspectRatio) {
    raw.aspect_ratio = options.aspectRatio;
  }

  return zodSchema.parse(raw);
}
