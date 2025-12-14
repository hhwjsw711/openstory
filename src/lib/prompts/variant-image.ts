import type { ImageSize } from '@/lib/constants/aspect-ratios';

/**
 * Get aspect ratio description for the prompt based on image size
 */
function getAspectRatioDescription(imageSize: ImageSize): string {
  switch (imageSize) {
    case 'portrait_16_9':
      return 'The final image is portrait orientation (9:16 aspect ratio, taller than wide). Arrange the 9 panels in a 3-column by 3-row grid that fits naturally within a tall, vertical frame.';
    case 'square_hd':
      return 'The final image is square (1:1 aspect ratio). Arrange the 9 panels in a balanced 3x3 grid.';
    case 'landscape_16_9':
    default:
      return 'The final image is landscape orientation (16:9 aspect ratio, wider than tall). Arrange the 9 panels in a 3-column by 3-row grid that fits naturally within a wide, horizontal frame.';
  }
}

/**
 * Generate variant image prompt with aspect ratio context
 */
export function getVariantImagePrompt(imageSize: ImageSize): string {
  const aspectDescription = getAspectRatioDescription(imageSize);

  return `Create a 9-panel cinematic storyboard sheet arranged as exactly 3 panels across (horizontal) and 3 panels down (vertical), derived from the style and subject of the provided image reference. The aesthetic should be that of a high-budget motion picture.

${aspectDescription}

Visual Parameters:

Lighting: Chiaroscuro lighting with high dynamic range.

Texture: 35mm film grain, hyper-realistic textures.

Color: Color grade must perfectly match the reference image's LUT.

Composition: A sequence of 9 distinct frames showing a progression of action, laid out in a 3-column by 3-row grid. Include 'Wide' (setting the scene), 'Medium' (action), and 'Tight' (emotion) shots. There should be no borders between images.

Strict Negative Constraint: No borders between images, Zero text. No dialogue bubbles, no scene numbers, no 'Lorem Ipsum', and no subtitles. The final image should look like a clean, text-free photography contact sheet.`;
}

/** @deprecated Use getVariantImagePrompt(imageSize) instead */
const VARIANT_IMAGE_PROMPT = getVariantImagePrompt('landscape_16_9');
