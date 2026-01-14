/**
 * Upscale variant workflow
 * Upscales a cropped variant tile to higher resolution in the background
 */

import { updateFrame } from '@/lib/db/helpers/frames';
import { uploadImageToStorage } from '@/lib/image/image-storage';
import { upscaleWithNanoBanana } from '@/lib/image/image-upscale';
import { getGenerationChannel } from '@/lib/realtime';
import type {
  UpscaleVariantWorkflowInput,
  UpscaleVariantWorkflowResult,
} from '@/lib/workflow/types';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

export const upscaleVariantWorkflow = createWorkflow(
  async (context: WorkflowContext<UpscaleVariantWorkflowInput>) => {
    const input = context.requestPayload;

    // Validate required fields
    if (!input.croppedTileUrl) {
      throw new WorkflowValidationError(
        'Cropped tile URL is required for upscaling'
      );
    }
    if (!input.frameId) {
      throw new WorkflowValidationError('Frame ID is required for upscaling');
    }

    console.log(
      '[UpscaleVariantWorkflow]',
      `Starting upscale for frame ${input.frameId}`
    );

    // Step 1: Upscale the cropped tile using Nano Banana Pro Edit
    const upscaleResult = await context.run('upscale-image', async () => {
      // Emit realtime progress
      await getGenerationChannel(input.sequenceId)?.emit(
        'generation.image:progress',
        {
          frameId: input.frameId,
          status: 'generating',
        }
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
        return null; // Signal to skip
      }

      const result = await upscaleWithNanoBanana(input.croppedTileUrl, '2K');

      return {
        imageUrl: result.imageUrl,
        requestId: result.requestId,
      };
    });

    // Early exit if frame was deleted
    if (!upscaleResult) {
      return { upscaledUrl: '', upscaledPath: '' };
    }

    // Step 2: Upload upscaled image to storage (replacing the cropped version)
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

    // Step 3: Update frame with upscaled thumbnail
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

      // Emit completion event
      const channel = getGenerationChannel(input.sequenceId);
      if (channel) {
        try {
          await channel.emit('generation.image:progress', {
            frameId: input.frameId,
            status: 'completed',
            thumbnailUrl: storageResult.url,
          });
        } catch {
          // Ignore emit errors
        }
      }

      console.log(
        '[UpscaleVariantWorkflow]',
        `Upscale completed for frame ${input.frameId}`
      );
    });

    const result: UpscaleVariantWorkflowResult = {
      upscaledUrl: storageResult.url,
      upscaledPath: storageResult.path || '',
    };

    return result;
  },
  {
    retries: 2,
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      console.error(
        '[UpscaleVariantWorkflow]',
        `Upscale failed for frame ${input.frameId}: ${failResponse}`
      );

      // Set status to completed - the cropped tile is still usable
      await updateFrame(
        input.frameId,
        {
          thumbnailStatus: 'completed',
          thumbnailGeneratedAt: new Date(),
        },
        { throwOnMissing: false }
      );

      // Emit completion event for UI feedback
      if (input.sequenceId) {
        try {
          const channel = getGenerationChannel(input.sequenceId);
          if (channel) {
            await channel.emit('generation.image:progress', {
              frameId: input.frameId,
              status: 'completed',
            });
          }
        } catch {
          // Ignore emit errors
        }
      }

      return `Upscale failed for frame ${input.frameId}`;
    },
  }
);
