import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import { DEFAULT_IMAGE_SIZE } from '@/lib/constants/aspect-ratios';
import { updateFrame } from '@/lib/db/helpers/frames';
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

        const model = input.model || DEFAULT_IMAGE_MODEL;

        if (input.frameId) {
          // update frame status to generating and store user prompt
          await updateFrame(input.frameId, {
            thumbnailStatus: 'generating',
            thumbnailWorkflowRunId: context.workflowRunId,
            imageModel: model,
            imagePrompt: input.prompt,
          });
        }

        // Return the generation params so it shows in the workflow context for debugging
        return {
          model,
          prompt: input.prompt,
          imageSize: input.imageSize ?? DEFAULT_IMAGE_SIZE,
          numImages: input.numImages ?? 1,
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

    const storageResult = await context.run('upload-to-storage', async () => {
      if (
        !input.frameId ||
        !input.sequenceId ||
        !input.teamId ||
        !imageResult.imageUrls[0]
      ) {
        throw new Error('Missing required IDs for storage upload');
      }

      const result = await uploadImageToStorage({
        imageUrl: imageResult.imageUrls[0],
        teamId: input.teamId,
        sequenceId: input.sequenceId,
        frameId: input.frameId,
      });

      if (!result.url) {
        throw new Error('Failed to upload image to storage');
      }

      await updateFrame(input.frameId, {
        thumbnailPath: result.path || null, // Store R2 path (permanent)
        thumbnailUrl: null, // Don't store signed URLs in DB (they expire)
        thumbnailStatus: 'completed',
        thumbnailGeneratedAt: new Date(),
        thumbnailError: null,
      });

      console.log(
        '[ImageWorkflow]',
        `Image uploaded to storage: ${result.path}`
      );
      return { url: result.url, path: result.path };
    });

    console.log('[ImageWorkflow]', 'Image generation workflow completed');

    // Return workflow result
    const result: ImageWorkflowResult = {
      thumbnailPath: storageResult.path,
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
