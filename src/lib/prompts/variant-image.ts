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
 * Generate variant image prompt with aspect ratio context and optional scene description
 */
export function getVariantImagePrompt(
  imageSize: ImageSize,
  scenePrompt?: string
): string {
  const aspectDescription = getAspectRatioDescription(imageSize);

  const sceneContext = scenePrompt
    ? `\nScene Description:\n${scenePrompt}\n`
    : '';

  return `Create a 9-panel cinematic storyboard sheet arranged as exactly 3 panels across (horizontal) and 3 panels down (vertical), derived from the style and subject of Image 1 (the primary source scene). It should be a sequence of 9 distinct frames showing a progression of action, laid out in a 3-column by 3-row grid. Include 'Wide' (setting the scene), 'Medium' (action), and 'Tight' (emotion) shots. There should be no borders between images.

Visual Parameters:

Lighting: Match Image 1's lighting setup exactly.

Texture: Match Image 1's texture and grain characteristics.

Color: Color grade must perfectly match Image 1's LUT.

Strict Negative Constraint: No borders between images, Zero text. No dialogue bubbles, no scene numbers, no 'Lorem Ipsum', and no subtitles. The final image should look like a clean, text-free photography contact sheet.

Aspect Ratio: ${aspectDescription}

${sceneContext}

CRITICAL: All 9 panels must depict variant shots of the SAME scene shown in Image 1. Any additional reference images (characters, locations) are provided solely for likeness and environment consistency — do NOT turn them into separate panels or subjects.

`;
}
