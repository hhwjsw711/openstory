/**
 * Shared helper: collects all deduplicated fal.ai endpoint IDs from our model configs.
 */
import {
  AUDIO_MODELS,
  IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
} from '@/lib/ai/models';

export function getFalEndpointIds(): string[] {
  const video = Object.values(IMAGE_TO_VIDEO_MODELS).map((m) => m.id);
  const image = Object.values(IMAGE_MODELS)
    .map((m) => m.id)
    .filter((id) => id !== 'letzai/image'); // LetzAI is not a fal model
  const audio = Object.values(AUDIO_MODELS).map((m) => m.id);
  const edit = ['fal-ai/nano-banana-pro/edit'];

  return [...new Set([...video, ...image, ...edit, ...audio])];
}
