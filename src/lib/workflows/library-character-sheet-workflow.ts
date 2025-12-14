/**
 * Library Character Sheet Generation Workflow
 *
 * Generates character reference sheets from user-uploaded reference media.
 * Uses the reference images to create a consistent character sheet.
 */

import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import { createCharacterSheet, getCharacterById } from '@/lib/db/helpers';
import { STORAGE_BUCKETS, uploadFile } from '@/lib/db/helpers/storage';
import { generateId } from '@/lib/db/id';
import { generateImageWithProvider } from '@/lib/image/image-generation';
import { getCharacterChannel } from '@/lib/realtime';
import type {
  LibraryCharacterSheetWorkflowInput,
  LibraryCharacterSheetWorkflowResult,
} from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

/**
 * Build a detailed character sheet prompt that uses reference images as the source of truth.
 * Uses the same multi-panel layout as sequence character sheets.
 */
function buildLibraryCharacterSheetPrompt(
  name: string,
  description?: string
): string {
  const descSection = description ? `\nUser Description:\n${description}` : '';

  return `Character Reference Sheet, highly detailed, photorealistic, studio lighting, extreme fidelity, clean aesthetic.

IMPORTANT: Use the provided reference images as the definitive source for this character's appearance.
Match all physical details exactly: age, build, skin tone, hair color/style, facial features, and clothing.

Layout Directive: Create a composite image with a precise multi-panel grid layout as described:

Top Row (Full-Body Turnaround): Four distinct, full-body views of the character: full frontal, direct side profile (90-degree turn), back three-quarter view, and full rear view (180-degree turn). All in a neutral, standing posture.

Middle-Left Grid (Headshot Matrix): A grid of 15 distinct head-and-shoulders portraits (3 rows of 5 images). Each portrait must capture a unique head angle and subtle expression variation, systematically rotating through: direct frontal, three-quarter left/right, near-profile left/right, slight head tilts. Maintain a generally neutral to contemplative expression range.

Lower-Central Panel (Posed Full-Body): A single full-body image of the character in a three-quarter stance, head slightly turned away from the camera, conveying a dynamic or pensive mood.

Right-Side Feature Panel (Large Headshot): A single, prominent, large close-up headshot, tightly framed for maximum facial detail, focused on the character's eyes and central features.

Character Identity Directive:
Name: ${name}
${descSection}

Physical Appearance, Attire, and Distinguishing Features:
DERIVE ALL DETAILS FROM THE REFERENCE IMAGES PROVIDED. Match the character's exact appearance.

Stylistic & Technical Parameters:

Lighting: Soft, even, professional studio lighting from multiple sources to minimize harsh shadows and maximize visibility of form and detail, consistent across all panels.

Background: Uniform, seamless, solid neutral light-to-medium gray studio backdrop for all panels, matching the clean simplicity of a professional reference sheet.

Focus: Ultra-sharp, deep focus on the character in every panel, ensuring clarity of all features and clothing details.

Mood: Objective, detailed, and clear, characteristic of a high-end visual reference or concept art.

Composition: Ensure proper spacing and alignment between all panels to form a cohesive contact sheet.

Maintain absolute consistency with reference images across all panels.`;
}

export const libraryCharacterSheetWorkflow = createWorkflow(
  async (
    context: WorkflowContext<LibraryCharacterSheetWorkflowInput>
  ): Promise<LibraryCharacterSheetWorkflowResult> => {
    const input = context.requestPayload;

    // Step 1: Validate input
    await context.run('validate-input', async () => {
      if (!input.characterId) {
        throw new WorkflowValidationError('characterId is required');
      }
      if (!input.referenceImageUrls || input.referenceImageUrls.length === 0) {
        throw new WorkflowValidationError(
          'At least one reference image is required'
        );
      }

      // Verify character exists and belongs to team
      const character = await getCharacterById(input.characterId);
      if (!character) {
        throw new WorkflowValidationError('Character not found');
      }
      if (character.teamId !== input.teamId) {
        throw new WorkflowValidationError('Character does not belong to team');
      }

      console.log(
        '[LibraryCharacterSheetWorkflow]',
        `Starting sheet generation for character ${input.characterName} with ${input.referenceImageUrls.length} reference images`
      );

      // Emit generating status
      await getCharacterChannel(input.characterId)?.emit(
        'character.sheet:progress',
        {
          characterId: input.characterId,
          status: 'generating',
        }
      );
    });

    // Step 2: Generate the character sheet image with references
    const imageResult = await context.run('generate-sheet-image', async () => {
      const model = input.imageModel ?? DEFAULT_IMAGE_MODEL;
      const prompt = buildLibraryCharacterSheetPrompt(
        input.characterName,
        input.characterDescription
      );

      console.log(
        '[LibraryCharacterSheetWorkflow]',
        `Generating sheet with model ${model}`
      );

      return await generateImageWithProvider({
        model,
        prompt,
        referenceImageUrls: input.referenceImageUrls,
        imageSize: 'landscape_16_9',
        numImages: 1,
        resolution: '2K',
      });
    });

    const imageUrl = imageResult.imageUrls[0];
    if (!imageUrl) {
      throw new Error('No image URL returned from generation');
    }

    // Step 3: Upload to R2 storage
    const storageResult = await context.run('upload-to-storage', async () => {
      console.log(
        '[LibraryCharacterSheetWorkflow]',
        `Uploading sheet to storage`
      );

      // Fetch the generated image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch generated image: ${response.status}`);
      }
      const imageBlob = await response.blob();

      // Build storage path
      const sheetId = generateId();
      const storagePath = `${input.teamId}/${input.characterId}/${sheetId}.png`;

      const result = await uploadFile(
        STORAGE_BUCKETS.CHARACTERS,
        storagePath,
        imageBlob,
        { contentType: 'image/png' }
      );

      return {
        sheetId,
        url: result.publicUrl,
        path: result.path,
      };
    });

    // Step 4: Create character sheet record
    const sheet = await context.run('create-sheet-record', async () => {
      console.log(
        '[LibraryCharacterSheetWorkflow]',
        `Creating sheet record in database`
      );

      return await createCharacterSheet({
        id: storageResult.sheetId,
        characterId: input.characterId,
        name: input.sheetName ?? 'Generated Sheet',
        imageUrl: storageResult.url,
        imagePath: storageResult.path,
        isDefault: false,
        source: 'ai_generated',
      });
    });

    // Emit completed status
    await context.run('emit-completed', async () => {
      console.log(
        '[LibraryCharacterSheetWorkflow]',
        `Character sheet workflow completed for ${input.characterName}`
      );

      await getCharacterChannel(input.characterId)?.emit(
        'character.sheet:progress',
        {
          characterId: input.characterId,
          status: 'completed',
          sheetId: sheet.id,
          sheetImageUrl: storageResult.url,
        }
      );
    });

    return {
      sheetId: sheet.id,
      sheetImageUrl: storageResult.url,
      sheetImagePath: storageResult.path,
    };
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      console.error(
        '[LibraryCharacterSheetWorkflow]',
        `Sheet generation failed for character ${input.characterName}: ${failResponse}`
      );

      // Emit failed status
      await getCharacterChannel(input.characterId)?.emit(
        'character.sheet:progress',
        {
          characterId: input.characterId,
          status: 'failed',
          error: `Sheet generation failed: ${failResponse}`,
        }
      );

      return `Character sheet generation failed for ${input.characterName}`;
    },
  }
);
