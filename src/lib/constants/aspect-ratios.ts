import { z } from 'zod';

export type AspectRatio = '16:9' | '9:16' | '1:1';

export const aspectRatioSchema = z.enum(['16:9', '9:16', '1:1']);

type AspectRatioOption = {
  value: AspectRatio;
  label: string;
  width: number;
  height: number;
};

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { value: '16:9', label: '16:9', width: 16, height: 9 },
  { value: '9:16', label: '9:16', width: 9, height: 16 },
  { value: '1:1', label: '1:1', width: 1, height: 1 },
];

export const DEFAULT_ASPECT_RATIO: AspectRatio = '16:9';

export const getAspectRatioData = (ratio: AspectRatio) => {
  return ASPECT_RATIOS.find((r) => r.value === ratio);
};

/**
 * Image size presets for LetzAI and other image generation providers.
 * These correspond to the LETZAI_PRESET_DIMENSIONS in image-workflow.ts
 */
export type ImageSize = 'square_hd' | 'portrait_16_9' | 'landscape_16_9';

export const DEFAULT_IMAGE_SIZE: ImageSize = 'landscape_16_9';
/**
 * Maps aspect ratios to image size presets for image generation.
 * Defaults to landscape_16_9 if aspect ratio is not recognized.
 */
export const aspectRatioToImageSize = (aspectRatio: AspectRatio): ImageSize => {
  const mapping: Record<AspectRatio, ImageSize> = {
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_16_9',
    '1:1': 'square_hd',
  };
  return mapping[aspectRatio] ?? 'landscape_16_9';
};
