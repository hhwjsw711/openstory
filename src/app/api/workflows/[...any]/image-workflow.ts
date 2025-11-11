import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import { Scene } from '@/lib/ai/scene-analysis.schema';
import { DEFAULT_IMAGE_SIZE } from '@/lib/constants/aspect-ratios';
import { db } from '@/lib/db/client';
import { updateFrame } from '@/lib/db/helpers/frames';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { frames, sequences } from '@/lib/db/schema';
import {
  generateImageWithProvider,
  ImageGenerationParams,
} from '@/lib/image/image-generation';
import { uploadImageToStorage } from '@/lib/image/image-storage';
import type { ImageWorkflowInput, ImageWorkflowResult } from '@/lib/workflow';
import { validateWorkflowAuth } from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/nextjs';
import { eq } from 'drizzle-orm';

export const maxDuration = 800; // This function can run for a maximum of 800 seconds

export const generateImageWorkflow = createWorkflow(
  async (context: WorkflowContext<ImageWorkflowInput>) => {
    const input = context.requestPayload;

    // Step 1: Set status to generating if frameId is provided
    const generationParams: ImageGenerationParams = await context.run(
      'set-generating-status',
      async () => {
        // Validate authentication
        validateWorkflowAuth(input);

        // Validate required fields
        if (!input.prompt || input.prompt.trim().length === 0) {
          throw new WorkflowValidationError(
            'Prompt is required for image generation'
          );
        }

        console.log(
          '[ImageWorkflow]',
          `Starting image generation workflow for user ${input.userId}`
        );

        if (input.frameId) {
          // update frame status to generating
          await updateFrame(input.frameId, {
            thumbnailStatus: 'generating',
            thumbnailWorkflowRunId: context.workflowRunId,
          });
        }

        // Return the generation params so it shows in the workflow context for debugging
        let model = input.model;
        if (!model) model = DEFAULT_IMAGE_MODEL;

        // Generate image using selected AI provider
        return {
          model,
          prompt: input.prompt,
          imageSize: input.imageSize || DEFAULT_IMAGE_SIZE,
          numImages: input.numImages || 1,
          seed: input.seed,
        };
      }
    );

    // Step 2: Generate image
    const imageResult = await context.run('generate-image', async () => {
      console.log(
        '[ImageWorkflow]',
        `Generating image ${input.frameId} with model ${generationParams.model}`
      );

      return await generateImageWithProvider(generationParams);
    });

    // Step 3: Upload image to storage if frameId is provided
    let storageUrl = imageResult.imageUrls[0]; // Default to FAL URL if upload fails
    if (input.frameId && imageResult.imageUrls.length > 0) {
      storageUrl = await context.run('upload-to-storage', async () => {
        if (!input.frameId || !input.sequenceId || !input.teamId) {
          console.warn(
            '[ImageWorkflow]',
            'Missing required IDs for storage upload, using temporary URL'
          );
          return imageResult.imageUrls[0];
        }

        try {
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

          console.log(
            '[ImageWorkflow]',
            `Image uploaded to storage: ${result.path}`
          );
          return result.url;
        } catch (error) {
          console.error(
            '[ImageWorkflow]',
            `Failed to upload image to storage: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          // Fall back to temporary FAL URL if storage upload fails
          return imageResult.imageUrls[0];
        }
      });
    }

    await context.run('update-frame', async () => {
      // Step 4: Update frame if frameId is provided
      if (!input.frameId || imageResult.imageUrls.length === 0) {
        return { updated: false };
      }

      try {
        // Get existing frame to preserve metadata
        const existingFrame = await db.query.frames.findFirst({
          where: eq(frames.id, input.frameId),
          columns: { metadata: true },
        });

        await updateFrame(input.frameId, {
          thumbnailUrl: storageUrl,
          thumbnailStatus: 'completed',
          thumbnailGeneratedAt: new Date(),
          thumbnailError: null,
          metadata: {
            ...(existingFrame?.metadata as unknown as Scene),
            sourceImageUrl: imageResult.imageUrls[0], // Store temporary FAL URL for API calls
          },
        });
      } catch (error) {
        console.error(
          '[ImageWorkflow]',
          `Failed to update frame ${input.frameId} with image URL: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        throw error;
      }

      return { updated: true };
    });

    await context.run('update-sequence-status', async () => {
      if (!input.sequenceId) {
        return { updated: false };
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
              (existingMetadata.frameGeneration as Record<string, unknown>) ||
              {};

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
              console.error(
                '[ImageWorkflow]',
                `Failed to update sequence ${input.sequenceId}: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          }
        }
      }

      return { updated: true };
    });

    console.log('[ImageWorkflow]', 'Image generation workflow completed');

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
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      // Set frame thumbnail status to 'failed' after all retries exhausted
      if (input.frameId) {
        await updateFrame(input.frameId, {
          thumbnailStatus: 'failed',
          thumbnailError: failResponse,
        });

        console.error(
          '[ImageWorkflow]',
          `Image generation failed for frame ${input.frameId}: ${failResponse}`
        );
      }

      return `Image generation failed for frame ${input.frameId}`;
    },
  }
);
