/**
 * Image Upscaling Service
 * Uses FAL.ai Nano Banana Pro Edit for upscaling
 */

import { createFalClient } from '@fal-ai/client';
import { calculateFalCost } from '@/lib/ai/fal-cost';
import { getEnv } from '#env';

type VariantResolution = '1K' | '2K' | '4K';

type UpscaleResult = {
  imageUrl: string;
  requestId: string;
  cost: number;
};

const UPSCALE_PROMPT = `Upscale this image to a clean, high-resolution frame suitable for animation.

RENDERING RULES
- Keep the original scene, pose, framing and camera angle IDENTICAL.
- Preserve the identity of all real people:
  - Do NOT change their faces, expressions, hairstyles, or clothing.
  - Do NOT add new people or remove existing people.
- Faces:
  - Make faces sharp and detailed.
  - Clear eyes, natural skin texture, no plastic or over-smoothed look.
- Text & logos:
  - Preserve all printed text, signage, and logos exactly as they appear.
  - Re-render text cleanly at higher resolution.
  - Do NOT invent new words, change names, or move signs.
- Style:
  - Realistic photographic look.
  - Keep original colours, lighting and depth of field.
  - No extra filters, bokeh, vignettes, film grain, or stylistic changes unless they already exist.

OUTPUT
- A SINGLE high-resolution image.
- Aspect ratio: match the original exactly.
- Resolution: upscale to animation-ready quality.
- No text overlays, borders, watermarks, or new graphics added by the model.`;

/**
 * Upscale a single image using Nano Banana Pro Edit
 */
export async function upscaleWithNanoBanana(
  imageUrl: string,
  resolution: VariantResolution = '2K',
  falApiKey?: string
): Promise<UpscaleResult> {
  const fal = createFalClient({
    credentials: falApiKey ?? getEnv().FAL_KEY ?? '',
  });

  const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
    input: {
      prompt: UPSCALE_PROMPT,
      image_urls: [imageUrl],
      num_images: 1,
      aspect_ratio: 'auto',
      resolution,
      output_format: 'png',
    },
    logs: true,
  });

  const outputUrl = result.data?.images?.[0]?.url;
  if (!outputUrl) {
    throw new Error('No image URL found in Nano Banana Pro Edit response');
  }

  const cost = await calculateFalCost(
    'fal-ai/nano-banana-pro/edit',
    1,
    'images',
    falApiKey
  );

  return {
    imageUrl: outputUrl,
    requestId: result.requestId ?? '',
    cost,
  };
}
