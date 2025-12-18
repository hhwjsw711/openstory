/**
 * Library Talent Sheet Generation Workflow
 *
 * Generates talent reference sheets from user-uploaded reference media.
 * Uses the reference images to create a consistent talent sheet.
 */

import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import {
  createTalentSheet,
  getTalentById,
  updateTalent,
} from '@/lib/db/helpers';
import { STORAGE_BUCKETS, uploadFile } from '@/lib/db/helpers/storage';
import { generateId } from '@/lib/db/id';
import { generateImageWithProvider } from '@/lib/image/image-generation';
import { getTalentChannel } from '@/lib/realtime';
import type {
  LibraryTalentSheetWorkflowInput,
  LibraryTalentSheetWorkflowResult,
} from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

/**
 * Build a detailed talent sheet prompt that uses reference images as the source of truth.
 * Uses the same multi-panel layout as sequence character sheets.
 */
function buildLibraryTalentSheetPrompt(
  name: string,
  description?: string
): string {
  const descSection = description ? `\nUser Description:\n${description}` : '';

  return `Character Reference Sheet, highly detailed, photorealistic, studio lighting, extreme fidelity, clean aesthetic.

IMPORTANT: Use the provided reference images as the definitive source for this person's appearance.
Match all physical details exactly: age, build, skin tone, hair color/style, facial features, and clothing.

Layout Directive: Create a composite image with a precise multi-panel grid layout as described:

Top Row (Full-Body Turnaround): Four distinct, full-body views of the person: full frontal, direct side profile (90-degree turn), back three-quarter view, and full rear view (180-degree turn). All in a neutral, standing posture.

Middle-Left Grid (Headshot Matrix): A grid of 15 distinct head-and-shoulders portraits (3 rows of 5 images). Each portrait must capture a unique head angle and subtle expression variation, systematically rotating through: direct frontal, three-quarter left/right, near-profile left/right, slight head tilts. Maintain a generally neutral to contemplative expression range.

Lower-Central Panel (Posed Full-Body): A single full-body image of the person in a three-quarter stance, head slightly turned away from the camera, conveying a dynamic or pensive mood.

Right-Side Feature Panel (Large Headshot): A single, prominent, large close-up headshot, tightly framed for maximum facial detail, focused on the person's eyes and central features.

Person Identity Directive:
Name: ${name}
${descSection}

Physical Appearance, Attire, and Distinguishing Features:
DERIVE ALL DETAILS FROM THE REFERENCE IMAGES PROVIDED. Match the person's exact appearance.

Stylistic & Technical Parameters:

Lighting: Soft, even, professional studio lighting from multiple sources to minimize harsh shadows and maximize visibility of form and detail, consistent across all panels.

Background: Uniform, seamless, solid neutral light-to-medium gray studio backdrop for all panels, matching the clean simplicity of a professional reference sheet.

Focus: Ultra-sharp, deep focus on the person in every panel, ensuring clarity of all features and clothing details.

Mood: Objective, detailed, and clear, characteristic of a high-end visual reference or concept art.

Composition: Ensure proper spacing and alignment between all panels to form a cohesive contact sheet.

Maintain absolute consistency with reference images across all panels.`;
}

/**
 * Build a prompt for generating a talent headshot/avatar.
 * Used as the talent's profile image.
 */
function buildTalentHeadshotPrompt(name: string, description?: string): string {
  const descSection = description ? `\nPerson notes: ${description}` : '';

  return `Professional headshot portrait of ${name}, photorealistic, studio lighting.

IMPORTANT: Use the provided reference images as the definitive source for this person's appearance.
Match all physical details exactly: face shape, skin tone, hair color/style, eye color, and any distinguishing features.

Requirements:
- Head and shoulders portrait, centered composition
- Neutral to friendly expression
- Direct eye contact with camera
- Soft, even professional studio lighting
- Clean, solid neutral background
- Sharp focus on face and eyes
- High detail on facial features
${descSection}

Style: Professional portrait photography, headshot for actor/model portfolio.
Aspect ratio: Square 1:1 format.
Maintain absolute consistency with reference images.`;
}

export const libraryTalentSheetWorkflow = createWorkflow(
  async (
    context: WorkflowContext<LibraryTalentSheetWorkflowInput>
  ): Promise<LibraryTalentSheetWorkflowResult> => {
    const input = context.requestPayload;

    // Step 1: Validate input
    await context.run('validate-input', async () => {
      if (!input.talentId) {
        throw new WorkflowValidationError('talentId is required');
      }
      if (!input.referenceImageUrls || input.referenceImageUrls.length === 0) {
        throw new WorkflowValidationError(
          'At least one reference image is required'
        );
      }

      // Verify talent exists and belongs to team
      const talentRecord = await getTalentById(input.talentId);
      if (!talentRecord) {
        throw new WorkflowValidationError('Talent not found');
      }
      if (talentRecord.teamId !== input.teamId) {
        throw new WorkflowValidationError('Talent does not belong to team');
      }

      console.log(
        '[LibraryTalentSheetWorkflow]',
        `Starting sheet generation for talent ${input.talentName} with ${input.referenceImageUrls.length} reference images`
      );

      // Emit generating status
      await getTalentChannel(input.talentId)?.emit('talent.sheet:progress', {
        talentId: input.talentId,
        status: 'generating',
      });
    });

    // Step 2: Generate the talent sheet image with references
    const imageResult = await context.run('generate-sheet-image', async () => {
      const model = input.imageModel ?? DEFAULT_IMAGE_MODEL;
      const prompt = buildLibraryTalentSheetPrompt(
        input.talentName,
        input.talentDescription
      );

      console.log(
        '[LibraryTalentSheetWorkflow]',
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
      console.log('[LibraryTalentSheetWorkflow]', `Uploading sheet to storage`);

      // Fetch the generated image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch generated image: ${response.status}`);
      }
      const imageBlob = await response.blob();

      // Build storage path
      const sheetId = generateId();
      const storagePath = `${input.teamId}/${input.talentId}/${sheetId}.png`;

      const result = await uploadFile(
        STORAGE_BUCKETS.TALENT,
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

    // Step 4: Create talent sheet record
    const sheet = await context.run('create-sheet-record', async () => {
      console.log(
        '[LibraryTalentSheetWorkflow]',
        `Creating sheet record in database`
      );

      return await createTalentSheet({
        id: storageResult.sheetId,
        talentId: input.talentId,
        name: input.sheetName ?? 'Generated Sheet',
        imageUrl: storageResult.url,
        imagePath: storageResult.path,
        isDefault: false,
        source: 'ai_generated',
      });
    });

    // Step 5: Generate talent headshot for avatar
    const headshotResult = await context.run(
      'generate-headshot-image',
      async () => {
        const model = input.imageModel ?? DEFAULT_IMAGE_MODEL;
        const prompt = buildTalentHeadshotPrompt(
          input.talentName,
          input.talentDescription
        );

        console.log(
          '[LibraryTalentSheetWorkflow]',
          `Generating headshot with model ${model}`
        );

        return await generateImageWithProvider({
          model,
          prompt,
          referenceImageUrls: input.referenceImageUrls,
          imageSize: 'square_hd',
          numImages: 1,
        });
      }
    );

    const headshotUrl = headshotResult.imageUrls[0];
    if (!headshotUrl) {
      throw new Error('No headshot URL returned from generation');
    }

    // Step 6: Upload headshot to R2 storage
    const headshotStorageResult = await context.run(
      'upload-headshot-to-storage',
      async () => {
        console.log(
          '[LibraryTalentSheetWorkflow]',
          `Uploading headshot to storage`
        );

        // Fetch the generated headshot
        const response = await fetch(headshotUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch generated headshot: ${response.status}`
          );
        }
        const imageBlob = await response.blob();

        // Build storage path for headshot
        const headshotPath = `${input.teamId}/${input.talentId}/headshot.png`;

        const result = await uploadFile(
          STORAGE_BUCKETS.TALENT,
          headshotPath,
          imageBlob,
          { contentType: 'image/png' }
        );

        return {
          url: result.publicUrl,
          path: result.path,
        };
      }
    );

    // Step 7: Update talent with headshot
    await context.run('update-talent-headshot', async () => {
      console.log(
        '[LibraryTalentSheetWorkflow]',
        `Updating talent with headshot`
      );

      await updateTalent(input.talentId, input.teamId, {
        imageUrl: headshotStorageResult.url,
        imagePath: headshotStorageResult.path,
      });
    });

    // Emit completed status
    await context.run('emit-completed', async () => {
      console.log(
        '[LibraryTalentSheetWorkflow]',
        `Talent sheet workflow completed for ${input.talentName}`
      );

      await getTalentChannel(input.talentId)?.emit('talent.sheet:progress', {
        talentId: input.talentId,
        status: 'completed',
        sheetId: sheet.id,
        sheetImageUrl: storageResult.url,
        headshotImageUrl: headshotStorageResult.url,
      });
    });

    return {
      sheetId: sheet.id,
      sheetImageUrl: storageResult.url,
      sheetImagePath: storageResult.path,
      headshotImageUrl: headshotStorageResult.url,
      headshotImagePath: headshotStorageResult.path,
    };
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      console.error(
        '[LibraryTalentSheetWorkflow]',
        `Sheet generation failed for talent ${input.talentName}: ${failResponse}`
      );

      // Emit failed status
      await getTalentChannel(input.talentId)?.emit('talent.sheet:progress', {
        talentId: input.talentId,
        status: 'failed',
        error: `Sheet generation failed: ${failResponse}`,
      });

      return `Talent sheet generation failed for ${input.talentName}`;
    },
  }
);
