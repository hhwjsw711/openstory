import {
  type FalImageGenerationParams,
  type FalImageResponse,
  generateImage as generateImageFal,
  IMAGE_MODELS,
} from '@/lib/ai/fal-client';
import type { LetzAIMode } from '@/lib/ai/letzai-client';
import { generateImage as generateImageLetzAI } from '@/lib/ai/letzai-client';
import { AI_PROVIDER_MAPPINGS, DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import { db } from '@/lib/db/client';
import { updateFrame } from '@/lib/db/helpers/frames';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { frames, sequences } from '@/lib/db/schema';
import type {
  LetzAIImageRequest,
  LetzAIImageResponse,
} from '@/lib/schemas/letzai-request';
import { LoggerService } from '@/lib/services/logger.service';
import type { ImageWorkflowInput, ImageWorkflowResult } from '@/lib/workflow';
import { validateWorkflowAuth } from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/nextjs';
import { eq } from 'drizzle-orm';

const loggerService = new LoggerService('ImageWorkflow');

const LETZAI_PRESET_DIMENSIONS: Record<
  string,
  { width: number; height: number }
> = {
  square_hd: { width: 1024, height: 1024 },
  square: { width: 768, height: 768 },
  portrait_4_3: { width: 672, height: 896 },
  portrait_16_9: { width: 576, height: 1024 },
  landscape_4_3: { width: 1024, height: 768 },
  landscape_16_9: { width: 1600, height: 900 },
} as const;

export const generateImageWorkflow = createWorkflow(
  async (context: WorkflowContext<ImageWorkflowInput>) => {
    const input = context.requestPayload;

    // Validate authentication
    validateWorkflowAuth(input);

    // Validate required fields
    if (!input.prompt || input.prompt.trim().length === 0) {
      throw new WorkflowValidationError(
        'Prompt is required for image generation'
      );
    }

    loggerService.logDebug(
      `Starting image generation workflow for user ${input.userId}`
    );

    // Step 1: Set status to generating if frameId is provided
    if (input.frameId) {
      await context.run('set-generating-status', async () => {
        if (!input.frameId) return;
        await updateFrame(input.frameId, {
          thumbnailStatus: 'generating',
          thumbnailWorkflowRunId: context.workflowRunId,
        });
      });
    }

    // Step 2: Generate image
    const imageResult = await context.run('generate-image', async () => {
      // Determine model to use
      let model = input.model;
      if (!model) model = DEFAULT_IMAGE_MODEL;

      loggerService.logDebug(
        `Generating image ${input.frameId} with model ${model}`
      );

      try {
        // Generate image using selected AI provider
        const resp = await generateImageWithProvider({
          model: IMAGE_MODELS[model],
          prompt: input.prompt,
          image_size: input.imageSize,
          num_images: input.numImages || 1,
          seed: input.seed,
        });

        const respData = resp.data as unknown as
          | FalImageResponse
          | LetzAIImageResponse;
        const result = resultByProvider(
          model,
          input as unknown as Record<string, unknown>,
          respData
        );

        return result;
      } catch (error) {
        // Update status on error if frameId is provided
        if (input.frameId) {
          await updateFrame(input.frameId, {
            thumbnailStatus: 'generating',
            thumbnailError:
              error instanceof Error ? error.message : 'Unknown error',
          });
        }
        throw error; // Re-throw so QStash will retry
      }
    });

    // Step 3: Upload image to storage if frameId is provided
    let storageUrl = imageResult.imageUrls[0]; // Default to FAL URL if upload fails
    if (input.frameId && imageResult.imageUrls.length > 0) {
      storageUrl = await context.run('upload-to-storage', async () => {
        if (!input.frameId || !input.sequenceId || !input.teamId) {
          loggerService.logWarning(
            'Missing required IDs for storage upload, using temporary URL'
          );
          return imageResult.imageUrls[0];
        }

        try {
          const { uploadImageToStorage } = await import(
            '@/lib/services/image-storage.service'
          );

          const result = await uploadImageToStorage({
            imageUrl: imageResult.imageUrls[0],
            teamId: input.teamId,
            sequenceId: input.sequenceId,
            frameId: input.frameId,
          });

          if (!result.success || !result.url) {
            throw new Error(
              result.error || 'Failed to upload image to storage'
            );
          }

          loggerService.logDebug(`Image uploaded to storage: ${result.path}`);
          return result.url;
        } catch (error) {
          loggerService.logError(
            `Failed to upload image to storage: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          // Fall back to temporary FAL URL if storage upload fails
          return imageResult.imageUrls[0];
        }
      });
    }

    // Step 4: Update frame if frameId is provided
    if (input.frameId && imageResult.imageUrls.length > 0) {
      await context.run('update-frame', async () => {
        if (!input.frameId) {
          throw new Error('frameId is required for update-frame step');
        }

        try {
          await updateFrame(input.frameId, {
            thumbnailUrl: storageUrl,
            thumbnailStatus: 'completed',
            thumbnailGeneratedAt: new Date(),
            thumbnailError: null,
          });
        } catch (error) {
          loggerService.logError(
            `Failed to update frame ${input.frameId} with image URL: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          throw error;
        }

        return { updated: true };
      });

      // Step 5: Check if all frames are complete and update sequence
      if (input.sequenceId) {
        await context.run('update-sequence-status', async () => {
          if (!input.sequenceId) {
            throw new Error(
              'sequenceId is required for update-sequence-status step'
            );
          }

          // Check if all frames for this sequence now have thumbnails
          const allFrames = await db
            .select({ id: frames.id, thumbnailUrl: frames.thumbnailUrl })
            .from(frames)
            .where(eq(frames.sequenceId, input.sequenceId));

          if (allFrames.length > 0) {
            const framesWithThumbnails = allFrames.filter(
              (frame) => frame.thumbnailUrl
            );
            const allFramesHaveThumbnails =
              framesWithThumbnails.length === allFrames.length;

            if (allFramesHaveThumbnails) {
              const sequence = await getSequenceById(input.sequenceId);

              if (sequence) {
                const existingMetadata =
                  (sequence.metadata as Record<string, unknown>) || {};
                const frameGeneration =
                  (existingMetadata.frameGeneration as Record<
                    string,
                    unknown
                  >) || {};

                const updatedMetadata = {
                  ...existingMetadata,
                  frameGeneration: {
                    ...frameGeneration,
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    thumbnailsGenerating: false,
                  },
                };

                try {
                  await db
                    .update(sequences)
                    .set({
                      metadata: updatedMetadata,
                      status: 'completed',
                      updatedAt: new Date(),
                    })
                    .where(eq(sequences.id, input.sequenceId));
                } catch (error) {
                  loggerService.logError(
                    `Failed to update sequence ${input.sequenceId}: ${error instanceof Error ? error.message : 'Unknown error'}`
                  );
                }
              }
            }
          }

          return { updated: true };
        });
      }
    }

    loggerService.logDebug('Image generation workflow completed');

    // Return workflow result
    const result: ImageWorkflowResult = {
      imageUrl: storageUrl,
      thumbnailUrl: storageUrl,
      frameId: input.frameId,
      sequenceId: input.sequenceId,
    };

    return result;
  },
  {
    retries: 3,
    retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      // Set frame thumbnail status to 'failed' after all retries exhausted
      if (input.frameId) {
        await updateFrame(input.frameId, {
          thumbnailStatus: 'failed',
          thumbnailError: failResponse,
        });

        loggerService.logError(
          `Image generation failed for frame ${input.frameId}: ${failResponse}`
        );
      }

      return `Image generation failed for frame ${input.frameId}`;
    },
  }
);

/**
 * Select AI provider based on model
 */
function generateImageWithProvider(payload: Record<string, unknown>) {
  switch (payload.model) {
    case 'letzai/image': {
      const sizePreset = payload.image_size as string | undefined;
      const { width, height } = LETZAI_PRESET_DIMENSIONS[
        sizePreset ?? 'landscape_16_9'
      ] ?? {
        width: 1600,
        height: 900,
      };
      const letzaiPayload = {
        prompt: payload.prompt as string,
        width,
        height,
        quality: payload.quality || (5 as number),
        creativity: payload.creativity || (2 as number),
        hasWatermark: payload.hasWatermark || (false as boolean),
        systemVersion: payload.systemVersion || (3 as number),
        mode: (payload.mode as LetzAIMode) || 'cinematic',
      } as LetzAIImageRequest;
      return generateImageLetzAI(letzaiPayload);
    }
    default:
      return generateImageFal(payload as unknown as FalImageGenerationParams);
  }
}

/**
 * Parse result by provider
 */
function resultByProvider(
  model: string,
  data: Record<string, unknown>,
  resp: FalImageResponse | LetzAIImageResponse
) {
  const result = {
    imageUrls: [] as string[],
    parameters: data,
    generatedAt: new Date().toISOString(),
    processingTimeMs: 0,
    provider: AI_PROVIDER_MAPPINGS[model as keyof typeof AI_PROVIDER_MAPPINGS],
    metadata: {
      prompt: resp.prompt,
      model,
      dimensions: [] as { width: number; height: number }[],
      file_sizes: [] as number[],
      seed: (resp as { seed?: number }).seed,
      has_nsfw_concepts: (resp as { has_nsfw_concepts?: boolean[] })
        .has_nsfw_concepts,
      cost: (resp as { cost?: number }).cost,
      requestId: (resp as { requestId?: string }).requestId,
    },
  };

  switch (AI_PROVIDER_MAPPINGS[model as keyof typeof AI_PROVIDER_MAPPINGS]) {
    case 'letz-ai': {
      const generationSettings =
        (resp as { generationSettings?: Record<string, number> })
          .generationSettings ?? ({} as Record<string, number>);
      const reqDims = {
        width: (data as { width?: number }).width,
        height: (data as { height?: number }).height,
      };
      result.imageUrls = [
        (resp as { imageVersions?: { original: string } }).imageVersions
          ?.original as string,
      ];
      result.processingTimeMs = (resp as { latencyMs?: number }).latencyMs || 0;
      result.metadata.dimensions = [
        {
          width: generationSettings.width ?? reqDims.width ?? 1600,
          height: generationSettings.height ?? reqDims.height ?? 900,
        },
      ];
      break;
    }
    default: {
      const images = (
        resp as {
          images?: {
            url: string;
            width?: number;
            height?: number;
            file_size?: number;
          }[];
        }
      ).images;
      const timings = (resp as { timings?: { inference?: number } }).timings;
      const latencyMs = (resp as { latencyMs?: number }).latencyMs;
      const seed = (resp as { seed?: number }).seed;
      const has_nsfw_concepts = (resp as { has_nsfw_concepts?: boolean[] })
        .has_nsfw_concepts;

      result.imageUrls = Array.isArray(images)
        ? images.map((img: { url: string }) => img.url)
        : ([] as string[]);
      result.processingTimeMs = timings?.inference || latencyMs || 0;
      result.metadata.dimensions = Array.isArray(images)
        ? images.map((img: { width?: number; height?: number }) => ({
            width: img.width ?? 0,
            height: img.height ?? 0,
          }))
        : ([] as { width: number; height: number }[]);
      result.metadata.file_sizes = Array.isArray(images)
        ? images.map((img: { file_size?: number }) => img.file_size ?? 0)
        : ([] as number[]);
      result.metadata.seed = seed;
      result.metadata.has_nsfw_concepts = has_nsfw_concepts;
      break;
    }
  }

  return result;
}
