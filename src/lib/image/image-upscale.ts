/**
 * Image Upscaling Service
 * Uses FAL.ai Nano Banana Pro Edit for upscaling
 */

import { createFalClient } from '@fal-ai/client';
import { getEnv } from '#env';

type VariantResolution = '1K' | '2K' | '4K';

type UpscaleResult = {
  imageUrl: string;
  requestId: string;
  cost: number;
};

/**
 * Build the prompt for upscaling a single image
 */
function buildUpscalePrompt(): string {
  return `Upscale this image to a clean, high-resolution frame suitable for animation.

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
}

/**
 * Upscale a single image using Nano Banana Pro Edit
 * @param imageUrl - URL of the image to upscale
 * @param resolution - Target resolution ('1K', '2K', '4K')
 * @returns Promise resolving to upscaled image URL
 */
export async function upscaleWithNanoBanana(
  imageUrl: string,
  resolution: VariantResolution = '2K',
  falApiKey?: string
): Promise<UpscaleResult> {
  const fal = createFalClient({
    credentials: falApiKey ?? getEnv().FAL_KEY ?? '',
  });
  const prompt = buildUpscalePrompt();

  try {
    const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
      input: {
        prompt,
        image_urls: [imageUrl],
        num_images: 1,
        aspect_ratio: 'auto',
        resolution,
        output_format: 'png',
      },
      logs: true,
    });

    if (!result.data) {
      console.error('[upscaleWithNanoBanana] No data in response:', result);
      throw new Error('No data returned from Nano Banana Pro Edit');
    }

    const images = result.data.images;
    if (!images || images.length === 0 || !images[0].url) {
      console.error(
        '[upscaleWithNanoBanana] Unexpected response structure:',
        result.data
      );
      throw new Error('No image URL found in Nano Banana Pro Edit response');
    }

    // fal returns cost in metadata but it's not in the typed response
    let cost = 0;
    if (
      'metadata' in result &&
      result.metadata &&
      typeof result.metadata === 'object'
    ) {
      const meta = result.metadata;
      if ('cost' in meta && typeof meta.cost === 'number') {
        cost = meta.cost;
      }
    }

    return {
      imageUrl: images[0].url,
      requestId: result.requestId || '',
      cost,
    };
  } catch (error) {
    console.error('[upscaleWithNanoBanana] Error details:', {
      error,
      imageUrl,
      resolution,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error(
      `Failed to upscale image: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
