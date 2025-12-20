/**
 * Regenerate Frames Workflow
 *
 * Bulk regenerates frame images after character recast.
 * Includes ALL character sheet references for visual consistency.
 */

import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import { getFramesByIds } from '@/lib/db/helpers/frames';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { getSequenceCharactersWithSheets } from '@/lib/db/helpers/sequence-characters';
import type { CharacterMinimal, Frame } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';
import { buildPromptWithReferences } from '@/lib/prompts/character-prompt';
import type {
  ImageWorkflowInput,
  RegenerateFramesWorkflowInput,
} from '@/lib/workflow/types';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import type { FlowControl } from '@upstash/qstash';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { generateImageWorkflow } from './image-workflow';

/**
 * Match characters to a frame by their continuity tags
 * Pure function that works in-memory without DB queries
 */
function matchCharactersToFrame(
  allCharacters: CharacterMinimal[],
  characterTags: string[]
): CharacterMinimal[] {
  if (characterTags.length === 0) return [];

  return allCharacters.filter((char) => {
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
}

/**
 * Get visual prompt from frame metadata
 */
function getVisualPrompt(frame: Frame): string | null {
  return (
    // Image prompt overrides metadata prompt as it has the visual reference images
    frame.imagePrompt ||
    frame.metadata?.prompts?.visual?.fullPrompt ||
    frame.description ||
    null
  );
}

type FrameResult = {
  frameId: string;
  success: boolean;
  imageUrl?: string;
  error?: string;
};

export const regenerateFramesWorkflow = createWorkflow(
  async (context: WorkflowContext<RegenerateFramesWorkflowInput>) => {
    const input = context.requestPayload;
    const { sequenceId, frameIds, userId, teamId, triggeringCharacterId } =
      input;

    // Flow control for rate limiting (same as analyze-script-workflow)
    const flowControl: FlowControl = {
      key: 'fal-requests',
      rate: 10,
      period: '5s',
      parallelism: 10,
    };

    // Step 1: Get sequence for aspect ratio and image model
    const sequence = await context.run('get-sequence', async () => {
      const seq = await getSequenceById(sequenceId);
      if (!seq) {
        throw new WorkflowValidationError(`Sequence ${sequenceId} not found`);
      }
      return seq;
    });

    // Step 2: Get all characters with completed sheets for this sequence
    const allCharacters = await context.run('get-all-characters', async () => {
      const chars = await getSequenceCharactersWithSheets(sequenceId);
      console.log(
        '[RegenerateFramesWorkflow]',
        `Found ${chars.length} characters with completed sheets`
      );
      return chars;
    });

    // Step 3: Get affected frames
    const framesToRegenerate = await context.run('get-frames', async () => {
      const fetchedFrames = await getFramesByIds(frameIds);
      console.log(
        '[RegenerateFramesWorkflow]',
        `Found ${fetchedFrames.length}/${frameIds.length} frames to regenerate`
      );
      return fetchedFrames;
    });

    if (framesToRegenerate.length === 0) {
      return {
        totalFrames: 0,
        successCount: 0,
        failedFrames: [],
      };
    }

    // Step 4: Emit start event
    await context.run('emit-start', async () => {
      await getGenerationChannel(sequenceId).emit('generation.recast:start', {
        characterId: triggeringCharacterId,
        frameCount: framesToRegenerate.length,
      });
    });

    // Step 5: Determine image model and size
    const imageModel = input.imageModel ?? DEFAULT_IMAGE_MODEL;
    const imageSize = aspectRatioToImageSize(sequence.aspectRatio);

    // Step 6: Generate images in parallel with flow control
    const imageResults: FrameResult[] = await Promise.all(
      framesToRegenerate.map(async (frame) => {
        // Get visual prompt from frame metadata
        const visualPrompt = getVisualPrompt(frame);
        if (!visualPrompt) {
          return {
            frameId: frame.id,
            success: false,
            error: 'No prompt available',
          };
        }

        // Match characters to this frame's continuity tags
        const characterTags = frame.metadata?.continuity?.characterTags ?? [];
        const frameCharacters = matchCharactersToFrame(
          allCharacters,
          characterTags
        );

        // Build enhanced prompt with character references
        const { prompt: enhancedPrompt, referenceUrls } =
          buildPromptWithReferences(visualPrompt, frameCharacters);

        // Invoke image workflow
        const imageInput: ImageWorkflowInput = {
          userId,
          teamId,
          sequenceId,
          frameId: frame.id,
          prompt: enhancedPrompt,
          model: imageModel,
          imageSize,
          numImages: 1,
          referenceImageUrls: referenceUrls,
        };

        const { body, isFailed, isCanceled } = await context.invoke('image', {
          workflow: generateImageWorkflow,
          body: imageInput,
          retries: 3,
          retryDelay: 'pow(2, retried) * 1000',
          flowControl,
        });

        if (isFailed || isCanceled || !body?.imageUrl) {
          return {
            frameId: frame.id,
            success: false,
            error: 'Image generation failed',
          };
        }

        return {
          frameId: frame.id,
          success: true,
          imageUrl: body.imageUrl,
        };
      })
    );

    // Step 7: Emit completion event
    const successful = imageResults.filter((r) => r.success).length;
    const failed = imageResults.filter((r) => !r.success).length;

    await context.run('emit-complete', async () => {
      await getGenerationChannel(sequenceId).emit(
        'generation.recast:complete',
        {
          characterId: triggeringCharacterId,
          successCount: successful,
          failedCount: failed,
        }
      );
    });

    console.log(
      '[RegenerateFramesWorkflow]',
      `Completed: ${successful} success, ${failed} failed`
    );

    return {
      totalFrames: framesToRegenerate.length,
      successCount: successful,
      failedFrames: imageResults
        .filter((r) => !r.success)
        .map((r) => r.frameId),
    };
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      await getGenerationChannel(input.sequenceId).emit(
        'generation.recast:failed',
        {
          characterId: input.triggeringCharacterId,
          error: String(failResponse),
        }
      );

      console.error(
        '[RegenerateFramesWorkflow]',
        `Frame regeneration failed: ${failResponse}`
      );

      return `Frame regeneration failed: ${failResponse}`;
    },
  }
);
