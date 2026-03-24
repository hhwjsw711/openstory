// Prompt character limits by fal.ai endpoint ID.
// Source: maxLength from fal.ai OpenAPI schemas (json/fal.models.motion.json)

import type { MotionEndpointId } from './endpoint-map';

export const MOTION_PROMPT_LIMITS: Record<
  MotionEndpointId,
  number | undefined
> = {
  'fal-ai/bytedance/seedance/v1/pro/image-to-video': undefined,
  'fal-ai/veo3': 20_000,
  'fal-ai/veo3.1/image-to-video': 20_000,
  'fal-ai/kling-video/v2.5-turbo/pro/image-to-video': 2_500,
  'fal-ai/sora-2/image-to-video': 5_000,
  'fal-ai/kling-video/o1/image-to-video': 2_500,
  'fal-ai/kling-video/v3/pro/image-to-video': 2_500,
  'xai/grok-imagine-video/image-to-video': 4_096,
  'wan/v2.6/image-to-video/flash': 800,
};
