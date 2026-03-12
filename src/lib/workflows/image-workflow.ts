import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import { usdToMicros, microsToUsd } from '@/lib/billing/money';
import { DEFAULT_IMAGE_SIZE } from '@/lib/constants/aspect-ratios';
import { updateFrame } from '@/lib/db/helpers/frames';
import {
  generateImageWithProvider,
  type ImageGenerationParams,
} from '@/lib/image/image-generation';
import { uploadImageToStorage } from '@/lib/image/image-storage';
import { buildReferenceImagePrompt } from '@/lib/prompts/reference-image-prompt';
import { getGenerationChannel } from '@/lib/realtime';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import type { ImageWorkflowInput } from '@/lib/workflow/types';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

type ImageWorkflowResult = {
  imageUrl: string;
  frameId?: string;
  sequenceId?: string;
};

export const generateImageWorkflow = createWorkflow(
  async (
    context: WorkflowContext<ImageWorkflowInput>
  ): Promise<ImageWorkflowResult> => {
    const input = context.requestPayload;

    const generationParams = await context.run(
      'set-generating-status',
      async (): Promise<ImageGenerationParams | null> => {
        if (!input.prompt?.trim()) {
          throw new WorkflowValidationError(
            'Prompt is required for image generation'
          );
        }

        console.log(
          '[ImageWorkflow]',
          `Starting image generation for user ${input.userId}`
        );

        const model = input.model ?? DEFAULT_IMAGE_MODEL;

        if (input.frameId) {
          const frame = await updateFrame(
            input.frameId,
            {
              thumbnailStatus: 'generating',
              thumbnailWorkflowRunId: context.workflowRunId,
              imageModel: model,
              imagePrompt: input.prompt,
            },
            { throwOnMissing: false }
          );

          if (!frame) {
            console.log(
              '[ImageWorkflow]',
              `Frame ${input.frameId} was deleted, skipping`
            );
            return null;
          }

          await getGenerationChannel(input.sequenceId)?.emit(
            'generation.image:progress',
            { frameId: input.frameId, status: 'generating' }
          );
        }

        return {
          model,
          prompt: buildReferenceImagePrompt(
            input.prompt,
            input.referenceImages ?? []
          ).prompt,
          imageSize: input.imageSize ?? DEFAULT_IMAGE_SIZE,
          numImages: input.numImages ?? 1,
          seed: input.seed,
          referenceImageUrls:
            input.referenceImages?.map((ref) => ref.referenceImageUrl) ?? [],
          traceName: 'frame-image',
          teamId: input.teamId,
        } satisfies ImageGenerationParams;
      }
    );

    if (!generationParams) {
      return {
        imageUrl: '',
        frameId: input.frameId,
        sequenceId: input.sequenceId,
      } satisfies ImageWorkflowResult;
    }

    const imageResult = await context.run('generate-image', async () => {
      console.log(
        '[ImageWorkflow]',
        `Generating image ${input.frameId} with model ${generationParams.model}`
      );
      return generateImageWithProvider({
        ...generationParams,
      });
    });

    const imageCostRaw = imageResult.metadata.cost ?? 0;
    const imageCostMicros = usdToMicros(imageCostRaw);
    const { teamId, frameId, sequenceId } = input;
    if (imageCostMicros > 0 && teamId && !imageResult.metadata.usedOwnKey) {
      await context.run('deduct-credits', async () => {
        if (!(await hasEnoughCredits(teamId, imageCostMicros))) {
          console.warn(
            `[ImageWorkflow] Insufficient credits for team ${teamId} (cost: $${microsToUsd(imageCostMicros).toFixed(4)}), skipping deduction`
          );
          return;
        }
        await deductCredits(teamId, imageCostMicros, {
          userId: input.userId,
          description: `Image generation (${generationParams.model})`,
          metadata: {
            model: generationParams.model,
            frameId: input.frameId,
            sequenceId: input.sequenceId,
          },
        });
      });
    }

    let imageUrl: string = imageResult.imageUrls[0];

    if (imageUrl && frameId && sequenceId && teamId) {
      const storageUrl = await context.run('upload-to-storage', async () => {
        const result = await uploadImageToStorage({
          imageUrl,
          teamId,
          sequenceId,
          frameId,
        });

        if (!result.url) {
          throw new Error('Failed to upload image to storage');
        }

        const updatedFrame = await updateFrame(
          frameId,
          {
            thumbnailPath: result.path || null,
            thumbnailUrl: result.url,
            thumbnailStatus: 'completed',
            thumbnailGeneratedAt: new Date(),
            thumbnailError: null,
            videoUrl: null,
            videoPath: null,
            videoStatus: 'pending',
            videoWorkflowRunId: null,
            videoGeneratedAt: null,
            videoError: null,
          },
          { throwOnMissing: false }
        );

        if (!updatedFrame) {
          console.log(
            '[ImageWorkflow]',
            `Frame ${frameId} was deleted, skipping final update`
          );
          return;
        }

        await getGenerationChannel(sequenceId)?.emit(
          'generation.image:progress',
          { frameId, status: 'completed', thumbnailUrl: result.url }
        );

        console.log('[ImageWorkflow]', `Uploaded to storage: ${result.path}`);

        return result.url;
      });
      if (storageUrl) imageUrl = storageUrl;
    }

    console.log('[ImageWorkflow]', 'Image generation workflow completed');

    return { imageUrl, frameId, sequenceId };
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      if (input.frameId) {
        await updateFrame(
          input.frameId,
          { thumbnailStatus: 'failed', thumbnailError: failResponse },
          { throwOnMissing: false }
        );

        if (input.sequenceId) {
          try {
            await getGenerationChannel(input.sequenceId)?.emit(
              'generation.image:progress',
              { frameId: input.frameId, status: 'failed' }
            );
          } catch {
            // Ignore emit errors in failure handler
          }
        }

        console.error(
          '[ImageWorkflow]',
          `Image generation failed for frame ${input.frameId}: ${failResponse}`
        );
      }

      return `Image generation failed for frame ${input.frameId}`;
    },
  }
);
