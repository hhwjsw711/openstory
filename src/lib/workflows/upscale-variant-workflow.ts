import { updateFrame } from '@/lib/db/helpers/frames';
import { uploadImageToStorage } from '@/lib/image/image-storage';
import { upscaleWithNanoBanana } from '@/lib/image/image-upscale';
import { deductWorkflowCredits } from '@/lib/billing/workflow-deduction';
import { getGenerationChannel } from '@/lib/realtime';
import type {
  UpscaleVariantWorkflowInput,
  UpscaleVariantWorkflowResult,
} from '@/lib/workflow/types';
import { resolveWorkflowApiKeys } from '@/lib/workflow/resolve-keys';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

export const upscaleVariantWorkflow = createWorkflow(
  async (context: WorkflowContext<UpscaleVariantWorkflowInput>) => {
    const input = context.requestPayload;

    console.log(
      '[UpscaleVariantWorkflow]',
      `Starting upscale for frame ${input.frameId}`
    );

    const apiKeys = await context.run('resolve-api-keys', () =>
      resolveWorkflowApiKeys(input.teamId)
    );

    const upscaleResult = await context.run('upscale-image', async () => {
      await getGenerationChannel(input.sequenceId).emit(
        'generation.image:progress',
        { frameId: input.frameId, status: 'generating' }
      );

      const frame = await updateFrame(
        input.frameId,
        {
          thumbnailStatus: 'generating',
          thumbnailWorkflowRunId: context.workflowRunId,
        },
        { throwOnMissing: false }
      );

      if (!frame) {
        console.log(
          '[UpscaleVariantWorkflow]',
          `Frame ${input.frameId} was deleted, skipping workflow`
        );
        return null;
      }

      return upscaleWithNanoBanana(
        input.croppedTileUrl,
        '2K',
        apiKeys.falApiKey
      );
    });

    if (!upscaleResult) {
      return { upscaledUrl: '', upscaledPath: '' };
    }

    await context.run('deduct-credits', async () => {
      await deductWorkflowCredits({
        teamId: input.teamId,
        costUsd: upscaleResult.cost,
        usedOwnKey: !!apiKeys.falApiKey,
        userId: input.userId,
        description: 'Variant upscale (nano_banana_pro)',
        metadata: { frameId: input.frameId, sequenceId: input.sequenceId },
        workflowName: 'UpscaleVariantWorkflow',
      });
    });

    const storageResult = await context.run('upload-to-storage', async () => {
      const result = await uploadImageToStorage({
        imageUrl: upscaleResult.imageUrl,
        teamId: input.teamId,
        sequenceId: input.sequenceId,
        frameId: input.frameId,
      });

      if (!result.url) {
        throw new Error('Failed to upload upscaled image to storage');
      }

      return { url: result.url, path: result.path };
    });

    await context.run('update-frame', async () => {
      const updatedFrame = await updateFrame(
        input.frameId,
        {
          thumbnailUrl: storageResult.url,
          thumbnailPath: storageResult.path || null,
          thumbnailStatus: 'completed',
          thumbnailGeneratedAt: new Date(),
        },
        { throwOnMissing: false }
      );

      if (!updatedFrame) {
        console.log(
          '[UpscaleVariantWorkflow]',
          `Frame ${input.frameId} was deleted, skipping final update`
        );
        return;
      }

      await getGenerationChannel(input.sequenceId).emit(
        'generation.image:progress',
        {
          frameId: input.frameId,
          status: 'completed',
          thumbnailUrl: storageResult.url,
        }
      );

      console.log(
        '[UpscaleVariantWorkflow]',
        `Upscale completed for frame ${input.frameId}`
      );
    });

    return {
      upscaledUrl: storageResult.url,
      upscaledPath: storageResult.path || '',
    } satisfies UpscaleVariantWorkflowResult;
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      console.error(
        '[UpscaleVariantWorkflow]',
        `Upscale failed for frame ${input.frameId}: ${failResponse}`
      );

      await updateFrame(
        input.frameId,
        {
          thumbnailStatus: 'completed',
          thumbnailGeneratedAt: new Date(),
        },
        { throwOnMissing: false }
      );

      await getGenerationChannel(input.sequenceId).emit(
        'generation.image:progress',
        { frameId: input.frameId, status: 'completed' }
      );

      return `Upscale failed for frame ${input.frameId}`;
    },
  }
);
