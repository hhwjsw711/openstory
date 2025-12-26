/**
 * Frame Image Server Functions
 * Image generation operations for frames
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { sequenceAccessMiddleware, frameAccessMiddleware } from './middleware';
import {
  regenerateFrameSchema,
  generateVariantSchema,
} from '@/lib/schemas/frame.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { DEFAULT_IMAGE_MODEL, safeTextToImageModel } from '@/lib/ai/models';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import type {
  ImageWorkflowInput,
  StoryboardWorkflowInput,
  VariantWorkflowInput,
  UpscaleVariantWorkflowInput,
} from '@/lib/workflow/types';
import { triggerWorkflow } from '@/lib/workflow/client';
import { cropTileFromGrid } from '@/lib/image/image-crop';
import { uploadImageBufferToStorage } from '@/lib/image/image-storage';
import { updateFrame } from '@/lib/db/helpers/frames';
import { getSequenceCharactersWithSheets } from '@/lib/db/helpers/sequence-characters';
import type { Character } from '@/lib/db/schema';
import { buildCharacterReferenceImages } from '@/lib/prompts/character-prompt';
import type { ReferenceImageDescription } from '@/lib/prompts/reference-image-prompt';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get reference image URLs for characters in a frame
 * Matches characters by continuity tags and returns their sheet URLs
 */
function getSceneCharacterReferenceImages(
  allCharacters: Character[],
  characterTags: string[]
): ReferenceImageDescription[] {
  if (characterTags.length === 0) return [];

  const matchedCharacters = allCharacters.filter((char) => {
    const consistencyTag = (char.consistencyTag ?? '').toLowerCase();
    const charName = char.name.toLowerCase();

    return characterTags.some((tag) => {
      const tagLower = tag.toLowerCase();
      return (
        (consistencyTag && tagLower.includes(consistencyTag)) ||
        tagLower.includes(charName) ||
        tagLower.includes(char.characterId.toLowerCase())
      );
    });
  });

  return buildCharacterReferenceImages(matchedCharacters);
}

// ============================================================================
// Generate Frames (Storyboard Workflow)
// ============================================================================

/**
 * Generate all frames for a sequence
 * Triggers the storyboard workflow
 */
export const generateFramesFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .handler(async ({ context }) => {
    const workflowInput: StoryboardWorkflowInput = {
      userId: context.user.id,
      teamId: context.sequence.teamId,
      sequenceId: context.sequence.id,
      options: {
        framesPerScene: 3,
        generateThumbnails: true,
        generateDescriptions: true,
        aiProvider: 'openrouter',
        regenerateAll: true,
      },
    };

    const workflowRunId = await triggerWorkflow('/storyboard', workflowInput, {
      deduplicationId: `storyboard-${context.sequence.id}`,
    });

    return {
      workflowRunId,
      frames: [],
    };
  });

// ============================================================================
// Generate Image for Frame
// ============================================================================

const generateImageInputSchema = regenerateFrameSchema.extend({
  sequenceId: ulidSchema,
  frameId: ulidSchema,
});

/**
 * Generate/regenerate an image for a single frame
 * Triggers the image workflow with character reference images if available
 */
export const generateFrameImageFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(generateImageInputSchema))
  .handler(async ({ context, data }) => {
    const { frame, sequence } = context;

    // Determine which prompt to use (priority: provided > stored > AI-generated > description)
    const promptToUse =
      data.prompt ||
      frame.imagePrompt ||
      frame.metadata?.prompts?.visual?.fullPrompt ||
      frame.description;

    if (!promptToUse) {
      throw new Error('Frame has no prompt or description to regenerate from');
    }

    // Get character reference URLs for this frame (without modifying the prompt)
    const allCharacters = await getSequenceCharactersWithSheets(sequence.id);
    const characterTags = frame.metadata?.continuity?.characterTags ?? [];
    const referenceImages = getSceneCharacterReferenceImages(
      allCharacters,
      characterTags
    );

    // Determine which model to use (with runtime validation)
    const modelToUse =
      data.model || safeTextToImageModel(frame.imageModel, DEFAULT_IMAGE_MODEL);

    const workflowInput: ImageWorkflowInput = {
      userId: context.user.id,
      teamId: sequence.teamId,
      prompt: promptToUse,
      model: modelToUse,
      imageSize: aspectRatioToImageSize(sequence.aspectRatio),
      numImages: 1,
      frameId: frame.id,
      sequenceId: sequence.id,
      referenceImages,
    };

    const workflowRunId = await triggerWorkflow('/image', workflowInput, {
      deduplicationId: `image-${frame.id}`,
    });

    return {
      workflowRunId,
      frameId: frame.id,
    };
  });

// ============================================================================
// Generate Variants for Frame
// ============================================================================

const generateVariantsInputSchema = generateVariantSchema.extend({
  sequenceId: ulidSchema,
  frameId: ulidSchema,
});

/**
 * Generate variant images for a frame
 * Triggers the variant-image workflow
 */
export const generateFrameVariantsFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(generateVariantsInputSchema))
  .handler(async ({ context, data }) => {
    const { frame, sequence } = context;

    if (!frame.thumbnailUrl) {
      throw new Error('Frame must have a thumbnail image to generate variants');
    }

    const workflowInput: VariantWorkflowInput = {
      userId: context.user.id,
      teamId: sequence.teamId,
      sequenceId: sequence.id,
      frameId: frame.id,
      thumbnailUrl: frame.thumbnailUrl,
      model: data.model,
      imageSize: data.imageSize || aspectRatioToImageSize(sequence.aspectRatio),
      numImages: data.numImages ?? 1,
      seed: data.seed,
    };

    const workflowRunId = await triggerWorkflow(
      '/variant-image',
      workflowInput,
      {
        deduplicationId: `variant-${frame.id}`,
      }
    );

    return {
      workflowRunId,
      frameId: frame.id,
    };
  });

// ============================================================================
// Select Variant
// ============================================================================

const selectVariantInputSchema = z.object({
  sequenceId: ulidSchema,
  frameId: ulidSchema,
  variantIndex: z.number().int().min(0).max(8),
});

/**
 * Convert variant index (0-8) to row/column (1-3)
 * Grid layout:
 *   0 1 2
 *   3 4 5
 *   6 7 8
 */
function indexToRowCol(index: number): { row: number; col: number } {
  return {
    row: Math.floor(index / 3) + 1,
    col: (index % 3) + 1,
  };
}

/**
 * Select a variant panel from the 3x3 grid
 * Crops the tile and triggers upscale workflow
 */
export const selectFrameVariantFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(selectVariantInputSchema))
  .handler(async ({ context, data }) => {
    const { frame, sequence } = context;

    if (!frame.variantImageUrl) {
      throw new Error('Frame has no variant image to select from');
    }

    // Convert index to row/column
    const { row, col } = indexToRowCol(data.variantIndex);

    // Phase 1: Crop the tile immediately using WASM
    const cropResult = await cropTileFromGrid({
      gridImageUrl: frame.variantImageUrl,
      row,
      col,
    });

    // Upload cropped tile to storage
    const uploadResult = await uploadImageBufferToStorage({
      imageBuffer: cropResult.buffer,
      teamId: sequence.teamId,
      sequenceId: sequence.id,
      frameId: frame.id,
      contentType: 'image/png',
    });

    if (!uploadResult.url) {
      throw new Error('Failed to upload cropped image to storage');
    }

    // Update frame with cropped thumbnail and clear motion fields
    await updateFrame(frame.id, {
      thumbnailUrl: uploadResult.url,
      thumbnailPath: uploadResult.path || null,
      thumbnailStatus: 'generating',
      thumbnailError: null,
      // Clear motion fields since the thumbnail changed
      videoUrl: null,
      videoPath: null,
      videoStatus: 'pending',
      videoWorkflowRunId: null,
      videoGeneratedAt: null,
      videoError: null,
    });

    // Phase 2: Trigger background upscale workflow
    const workflowInput: UpscaleVariantWorkflowInput = {
      userId: context.user.id,
      teamId: sequence.teamId,
      sequenceId: sequence.id,
      frameId: frame.id,
      croppedTileUrl: uploadResult.url,
      croppedTilePath: uploadResult.path || '',
    };

    const workflowRunId = await triggerWorkflow(
      '/upscale-variant',
      workflowInput,
      {
        deduplicationId: `upscale-variant-${frame.id}-${Date.now()}`,
      }
    );

    return {
      frameId: frame.id,
      thumbnailUrl: uploadResult.url,
      variantIndex: data.variantIndex,
      upscaleWorkflowRunId: workflowRunId,
    };
  });
