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
} from '@/lib/db/helpers/talent';
import { STORAGE_BUCKETS, uploadFile } from '@/lib/db/helpers/storage';
import { generateId } from '@/lib/db/id';
import { generateImageWithProvider } from '@/lib/image/image-generation';
import {
  buildLibraryTalentSheetPrompt,
  buildTalentHeadshotPrompt,
} from '@/lib/prompts/character-prompt';
import { getTalentChannel } from '@/lib/realtime';
import type {
  LibraryTalentSheetWorkflowInput,
  LibraryTalentSheetWorkflowResult,
} from '@/lib/workflow/types';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { resolveWorkflowApiKeys } from '@/lib/workflow/resolve-keys';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

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

      // Verify talent exists and belongs to team
      const talentRecord = await getTalentById(input.talentId);
      if (!talentRecord) {
        throw new WorkflowValidationError('Talent not found');
      }
      if (talentRecord.teamId !== input.teamId) {
        throw new WorkflowValidationError('Talent does not belong to team');
      }

      const hasReferenceImages =
        input.referenceImageUrls && input.referenceImageUrls.length > 0;
      const imageCount = input.referenceImageUrls?.length ?? 0;

      console.log(
        '[LibraryTalentSheetWorkflow]',
        `Starting sheet generation for talent ${input.talentName}${hasReferenceImages ? ` with ${imageCount} reference images` : ' (no reference images - generating from name/description)'}`
      );

      // Emit generating status
      await getTalentChannel(input.talentId)?.emit('talent.sheet:progress', {
        talentId: input.talentId,
        status: 'generating',
      });
    });

    // Resolve team API keys (user-provided or platform fallback)
    const apiKeys = await context.run('resolve-api-keys', async () => {
      return resolveWorkflowApiKeys(input.teamId);
    });

    // Step 2: Generate the talent sheet image with references
    const imageResult = await context.run('generate-sheet-image', async () => {
      const model = input.imageModel ?? DEFAULT_IMAGE_MODEL;
      const hasReferenceImages =
        input.referenceImageUrls && input.referenceImageUrls.length > 0;
      const prompt = buildLibraryTalentSheetPrompt(
        input.talentName,
        input.talentDescription,
        hasReferenceImages
      );

      console.log(
        '[LibraryTalentSheetWorkflow]',
        `Generating sheet with model ${model}${hasReferenceImages ? ' (with reference images)' : ' (text-to-image only)'}`
      );

      const generationParams: Parameters<typeof generateImageWithProvider>[0] =
        {
          model,
          prompt,
          imageSize: 'landscape_16_9',
          numImages: 1,
          resolution: '2K',
          traceName: 'talent-sheet-image',
          falApiKey: apiKeys.falApiKey,
        };

      // Only include referenceImageUrls if provided
      if (hasReferenceImages) {
        generationParams.referenceImageUrls = input.referenceImageUrls;
      }

      return await generateImageWithProvider(generationParams);
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
        const hasReferenceImages =
          input.referenceImageUrls && input.referenceImageUrls.length > 0;
        const prompt = buildTalentHeadshotPrompt(
          input.talentName,
          input.talentDescription,
          hasReferenceImages
        );

        console.log(
          '[LibraryTalentSheetWorkflow]',
          `Generating headshot with model ${model}${hasReferenceImages ? ' (with reference images)' : ' (text-to-image only)'}`
        );

        const generationParams: Parameters<
          typeof generateImageWithProvider
        >[0] = {
          model,
          prompt,
          imageSize: 'square_hd',
          numImages: 1,
          traceName: 'talent-headshot-image',
          falApiKey: apiKeys.falApiKey,
        };

        // Only include referenceImageUrls if provided
        if (hasReferenceImages) {
          generationParams.referenceImageUrls = input.referenceImageUrls;
        }

        return await generateImageWithProvider(generationParams);
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
