/**
 * Fast preview workflow
 * Generates quick preview images (~3-5s) using text-based scene splitting
 * and a fast image model, while the full AI pipeline runs in parallel.
 */

import { fastSceneSplit } from '@/lib/ai/fast-scene-split';
import { PREVIEW_IMAGE_MODEL } from '@/lib/ai/models';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import type { NewFrame } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';
import { createScopedWorkflow } from '@/lib/workflow/scoped-workflow';
import type {
  FastPreviewWorkflowInput,
  ImageWorkflowInput,
} from '@/lib/workflow/types';

import { getFalFlowControl } from './constants';
import { generateImageWorkflow } from './image-workflow';

export const fastPreviewWorkflow = createScopedWorkflow<
  FastPreviewWorkflowInput,
  Array<{ sceneId: string; frameId: string }>
>(
  async (context, scopedDb) => {
    const input = context.requestPayload;
    const { script, aspectRatio } = input;

    if (!input.sequenceId) {
      throw new Error('sequenceId is required for fast preview');
    }
    const sequenceId = input.sequenceId;

    // Step 1: Fast text-based scene split (runs inline, ~0ms)
    const scenes = await context.run('fast-split', () => {
      const result = fastSceneSplit(script);
      console.log(
        '[FastPreview]',
        `Split script into ${result.length} preview scenes`
      );
      return result;
    });

    if (scenes.length === 0) {
      console.log('[FastPreview]', 'No scenes found, skipping preview');
      return [];
    }

    // Step 2: Create preview frames in DB
    const frameMapping = await context.run(
      'create-preview-frames',
      async () => {
        const frameInserts = scenes.map(
          (scene, index) =>
            ({
              sequenceId,
              description: scene.originalScript?.extract ?? '',
              orderIndex: index,
              metadata: scene,
              durationMs: Math.round(
                (scene.metadata?.durationSeconds ?? 3) * 1000
              ),
              videoStatus: 'pending',
            }) satisfies NewFrame
        );

        const createdFrames = await scopedDb.frames.bulkUpsert(frameInserts);
        const mapping = createdFrames.map((f) => ({
          sceneId: f.metadata?.sceneId ?? '',
          frameId: f.id,
        }));

        // Emit frame:created events for each preview frame
        for (const { sceneId, frameId } of mapping) {
          const scene = scenes.find((s) => s.sceneId === sceneId);
          await getGenerationChannel(sequenceId).emit(
            'generation.frame:created',
            {
              frameId,
              sceneId,
              orderIndex: scene?.sceneNumber ? scene.sceneNumber - 1 : 0,
            }
          );
        }

        return mapping;
      }
    );

    // Step 3: Generate preview images in parallel with fast model
    const imageSize = aspectRatioToImageSize(aspectRatio);

    await Promise.all(
      scenes.map(async (scene) => {
        const matchedFrame = frameMapping.find(
          (f) => f.sceneId === scene.sceneId
        );

        // Use raw script extract as the prompt for fast preview
        const prompt =
          scene.originalScript?.extract?.slice(0, 2000) ??
          scene.metadata?.title ??
          'A cinematic scene';

        await context.invoke('preview-image', {
          workflow: generateImageWorkflow,
          body: {
            userId: input.userId,
            teamId: input.teamId,
            prompt,
            model: PREVIEW_IMAGE_MODEL,
            imageSize,
            numImages: 1,
            frameId: matchedFrame?.frameId,
            sequenceId,
            skipStorage: true,
          } satisfies ImageWorkflowInput,
          retries: 1,
          flowControl: getFalFlowControl(),
        });
      })
    );

    console.log(
      '[FastPreview]',
      `Preview generation complete for ${scenes.length} scenes`
    );

    return frameMapping;
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const { sequenceId } = context.requestPayload;
      console.error('[FastPreview] Failure:', failResponse);

      // Preview failures are non-critical — the full pipeline continues
      if (sequenceId) {
        await getGenerationChannel(sequenceId).emit('generation.error', {
          message: `Preview generation failed: ${failResponse}`,
        });
      }

      return `Fast preview failed: ${failResponse}`;
    },
  }
);
