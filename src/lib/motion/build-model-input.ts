/**
 * Schema-Driven Model Input Builder
 *
 * Builds the fal.ai request body for a video model using generated
 * Zod transforms. Each transform accepts our internal camelCase format
 * (numeric duration, imageUrl) and produces the API's snake_case format
 * with correctly-typed duration values.
 */

import type {
  ImageToVideoModel,
  ImageToVideoModelConfig,
} from '@/lib/ai/models';
import { MOTION_TRANSFORMS, type MotionEndpointId } from './endpoint-map';
import type { GenerateMotionOptions } from './motion-generation';

/** Intentional deviations from API defaults */
const QUALITY_OVERRIDES: Partial<
  Record<ImageToVideoModel, Record<string, unknown>>
> = {
  veo3: { resolution: '1080p' },
  veo3_1: { resolution: '1080p' },
  seedance_v1_pro: { resolution: '1080p' },
};

export function buildModelInput(
  options: GenerateMotionOptions,
  modelConfig: ImageToVideoModelConfig,
  modelKey: ImageToVideoModel
) {
  const endpointId = modelConfig.id satisfies MotionEndpointId;
  const transform = MOTION_TRANSFORMS[endpointId];
  if (!transform) {
    throw new Error(`No transform found for model: ${modelConfig.id}`);
  }

  return transform.parse({
    prompt: options.prompt,
    duration: options.duration,
    imageUrl: options.imageUrl,
    aspectRatio: options.aspectRatio,
    ...QUALITY_OVERRIDES[modelKey],
  });
}
