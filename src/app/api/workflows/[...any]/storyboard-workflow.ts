/**
 * Frame generation workflow
 * Orchestrates script analysis, frame creation, and thumbnail generation
 */

import { generateImageWorkflow } from '@/app/api/workflows/[...any]/image-workflow';
import { generateMotionWorkflow } from '@/app/api/workflows/[...any]/motion-workflow';
import { DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL } from '@/lib/ai/models';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import { db } from '@/lib/db/client';
import { updateSequenceMetadata } from '@/lib/db/helpers/sequences';
import { sequences } from '@/lib/db/schema';
import { Sequence } from '@/lib/db/schema/sequences';
import {
  extractCharacterBible,
  generateAudioDesignForScenes,
  generateMotionPromptsForScenes,
  generateVisualPromptsForScenes,
  splitScriptIntoScenes,
} from '@/lib/script';
import { Scene } from '@/lib/script/types';
import { DirectorDnaConfigSchema } from '@/lib/services/director-dna-types';
import { frameService } from '@/lib/services/frame.service';
import type {
  ImageWorkflowInput,
  MotionWorkflowInput,
  StoryboardWorkflowInput,
} from '@/lib/workflow';
import { validateWorkflowAuth } from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/nextjs';
import { eq } from 'drizzle-orm';

export const maxDuration = 800; // This function can run for a maximum of 800 seconds

export const generateStoryboardWorkflow = createWorkflow(
  async (context: WorkflowContext<StoryboardWorkflowInput>) => {
    const input = context.requestPayload;

    // Validate authentication
    validateWorkflowAuth(input);

    console.log(
      '[StoryboardGenerationWorkflow]',
      `Starting storyboard generation workflow for sequence ${input.sequenceId}`
    );

    // Step 1: Verify sequence and get data
    const { sequence, styleConfig, analysisModel } = await context.run(
      'verify-clear-and-start-processing',
      async () => {
        const sequence = await db.query.sequences.findFirst({
          where: eq(sequences.id, input.sequenceId),
          with: {
            style: true,
          },
        });

        if (!sequence) {
          throw new WorkflowValidationError(
            `Sequence not found: ${input.sequenceId}`
          );
        }

        if (!sequence.script || sequence.script.trim().length === 0) {
          throw new WorkflowValidationError('Sequence has no script');
        }

        if (!sequence.styleId) {
          throw new WorkflowValidationError('Sequence has no style selected');
        }

        if (!sequence.style) {
          throw new WorkflowValidationError('No style found');
        }

        // Delete existing frames
        const existingFrames = await frameService.getFramesBySequence(
          input.sequenceId
        );

        if (existingFrames.length > 0) {
          await Promise.all(
            existingFrames.map((frame) => frameService.deleteFrame(frame.id))
          );
        }

        // Set sequence status to processing
        await db
          .update(sequences)
          .set({ status: 'processing', updatedAt: new Date() })
          .where(eq(sequences.id, input.sequenceId));

        const styleConfig = DirectorDnaConfigSchema.parse(
          sequence.style.config
        );

        // Use the sequence's analysisModel for script analysis
        const analysisModel =
          sequence.analysisModel || 'anthropic/claude-haiku-4.5';

        return { sequence, styleConfig, analysisModel };
      }
    );

    // Step 2: Split script into basic scenes and store in sequence metadata
    const { scenes: basicScenes, title } = await context.run(
      'split-script-into-scenes',
      async () => {
        if (!sequence.script) {
          throw new WorkflowValidationError('No script found');
        }

        const result = await splitScriptIntoScenes(
          sequence.script,
          sequence.aspectRatio,
          analysisModel
        );

        if (!result.scenes || result.scenes.length === 0) {
          throw new WorkflowValidationError(
            'Script splitting returned no scenes - script may be too short or invalid'
          );
        }

        return {
          scenes: result.scenes,
          title: result.projectMetadata?.title || 'Untitled',
        };
      }
    );

    const frameCount = basicScenes.length;

    // Step 3: Update sequence with title add add basic frames. Return a map of scene ID to frame ID.
    const frameMap: { sceneId: string; frameId: string }[] = await context.run(
      'update-title-and-create-frames',
      async () => {
        const updateData: Partial<Sequence> = {
          updatedAt: new Date(),
          title,
          metadata: {
            ...sequence.metadata,
            title,
          },
        };

        // Add the updated metadata to the sequence

        await db
          .update(sequences)
          .set(updateData)
          .where(eq(sequences.id, input.sequenceId));

        // Build array of all frames to create with basic scene data
        const frameInserts = basicScenes.map((scene, index) => ({
          sequenceId: input.sequenceId,
          description: scene.originalScript.extract,
          orderIndex: index,
          metadata: scene, // Store BasicScene object - will be enriched later
          durationMs: Math.round((scene.metadata.durationSeconds || 3) * 1000),
        }));

        // Bulk insert all frames at once
        const createdFrames = await frameService.bulkInsertFrames(frameInserts);

        // Create a map of scene ID to frame ID for later updates
        return createdFrames.map((frame) => ({
          sceneId: frame.metadata?.sceneId || '',
          frameId: frame.id,
        }));
      }
    );

    // Step 4: Extract character bible
    const characterBible = await context.run(
      'extract-character-bible',
      async () => {
        const characterBible = await extractCharacterBible(
          basicScenes,
          analysisModel
        );

        // Store character bible in sequence metadata
        await updateSequenceMetadata(input.sequenceId, {
          characterBible,
        });

        // Set sequence status to completed
        await db
          .update(sequences)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(sequences.id, input.sequenceId));

        return characterBible;
      }
    );

    // Process scenes in batches for phases 3-5
    const BATCH_SIZE = 5; // Process 5 scenes at a time

    const basicSceneBatches: Scene[][] = basicScenes.reduce(
      (acc, scene, index) => {
        const batchIndex = Math.floor(index / BATCH_SIZE);
        if (!acc[batchIndex]) {
          acc[batchIndex] = [];
        }
        acc[batchIndex].push(scene);
        return acc;
      },
      [] as Scene[][]
    );

    // Step 5: Generate visual prompts for each batch
    const visualPromptResults: Scene[][] = await Promise.all(
      basicSceneBatches.map(async (batch, batchIndex) => {
        return context.run(`visual-prompts-batch-${batchIndex}`, async () => {
          return await generateVisualPromptsForScenes(
            batch,
            characterBible,
            styleConfig,
            analysisModel
          );
        });
      })
    );

    // Update frames with visual prompt data (Phase 3)
    await context.run('update-frames-after-visual-prompts', async () => {
      const scenesWithVisualPrompts = visualPromptResults.flat();

      await Promise.all(
        scenesWithVisualPrompts.map(async (scene) => {
          const frameMapping = frameMap.find(
            (m) => m.sceneId === scene.sceneId
          );
          if (!frameMapping) return;

          await frameService.updateFrame({
            id: frameMapping.frameId,
            metadata: scene,
          });
        })
      );
    });

    // Step 6: Generate motion prompts for each batch
    const motionPromptResults: Scene[][] = await Promise.all(
      visualPromptResults.map(async (batchWithVisualPrompts, batchIndex) => {
        return context.run(`motion-prompts-batch-${batchIndex}`, async () => {
          return await generateMotionPromptsForScenes(
            batchWithVisualPrompts,
            analysisModel
          );
        });
      })
    );

    // Update frames with motion prompt data (Phase 4)
    await context.run('update-frames-after-motion-prompts', async () => {
      const scenesWithMotionPrompts = motionPromptResults.flat();

      await Promise.all(
        scenesWithMotionPrompts.map(async (scene) => {
          const frameMapping = frameMap.find(
            (m) => m.sceneId === scene.sceneId
          );
          if (!frameMapping) return;

          await frameService.updateFrame({
            id: frameMapping.frameId,
            metadata: scene,
          });
        })
      );
    });

    // Step 7: Generate audio design for each batch
    const audioDesignResults: Scene[][] = await Promise.all(
      motionPromptResults.map(async (batchWithMotionPrompts, batchIndex) => {
        return context.run(`audio-design-batch-${batchIndex}`, async () => {
          return await generateAudioDesignForScenes(
            batchWithMotionPrompts,
            analysisModel
          );
        });
      })
    );

    const completeScenes: Scene[] = audioDesignResults.flat();

    // Update frames with audio design data (Phase 5)
    await context.run('update-frames-after-audio-design', async () => {
      await Promise.all(
        completeScenes.map(async (scene) => {
          const frameMapping = frameMap.find(
            (m) => m.sceneId === scene.sceneId
          );
          if (!frameMapping) return;

          await frameService.updateFrame({
            id: frameMapping.frameId,
            metadata: scene,
          });
        })
      );
    });

    // Step 8: Generate thumbnails in parallel if enabled
    if (input.options?.generateThumbnails !== false) {
      // Map aspect ratio to image size preset
      const imageSize = aspectRatioToImageSize(sequence.aspectRatio);

      await Promise.all(
        frameMap.map(async ({ sceneId, frameId }) => {
          const scene = completeScenes.find(
            (scene) => scene.sceneId === sceneId
          );
          if (!scene) {
            console.warn(
              '[StoryboardGenerationWorkflow]',
              `Scene ${sceneId} not found, skipping`
            );
            return null;
          }

          // Check if visual prompt exists
          const visualPrompt = scene.prompts?.visual?.fullPrompt;
          if (!visualPrompt) {
            console.warn(
              '[StoryboardGenerationWorkflow]',
              `Frame ${frameId} has no visual prompt, skipping`
            );
            return null;
          }

          // Generate image for the frame
          const imageInput: ImageWorkflowInput = {
            userId: input.userId,
            teamId: input.teamId,
            prompt: visualPrompt,
            model: DEFAULT_IMAGE_MODEL,
            imageSize,
            numImages: 1,
            frameId,
            sequenceId: input.sequenceId,
          };

          const {
            body: imageBody,
            isFailed: imageIsFailed,
            isCanceled: imageIsCanceled,
          } = await context.invoke('image', {
            workflow: generateImageWorkflow,
            body: imageInput,
            retries: 3,
            retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
            flowControl: {
              key: 'fal-requests', // Shared key for both image & motion
              parallelism: process.env.FAL_CONCURRENCY_LIMIT
                ? parseInt(process.env.FAL_CONCURRENCY_LIMIT)
                : 10,
            },
            headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
              ? {
                  'x-vercel-protection-bypass':
                    process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
                }
              : undefined,
          });

          if (imageIsFailed || imageIsCanceled || !imageBody.thumbnailPath) {
            throw new WorkflowValidationError(
              `Image generation failed for frame ${frameId}, skipping motion generation`
            );
          }

          // Check if motion prompt exists
          const motionPrompt = scene.prompts?.motion?.fullPrompt;
          if (!motionPrompt) {
            console.warn(
              '[StoryboardGenerationWorkflow]',
              `Frame ${frameId} has no motion prompt, skipping motion generation`
            );
            return null;
          }

          // Trigger motion generation workflow
          const motionInput: MotionWorkflowInput = {
            userId: input.userId,
            teamId: input.teamId,
            frameId,
            sequenceId: input.sequenceId,
            thumbnailPath: imageBody.thumbnailPath,
            prompt: motionPrompt,
            model: DEFAULT_VIDEO_MODEL,
            aspectRatio: sequence.aspectRatio,
          };

          await context.invoke('motion', {
            workflow: generateMotionWorkflow,
            body: motionInput,
            retries: 3,
            retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
            flowControl: {
              key: 'fal-requests', // Shared key for both image & motion
              parallelism: process.env.FAL_CONCURRENCY_LIMIT
                ? parseInt(process.env.FAL_CONCURRENCY_LIMIT)
                : 10,
            },
            headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
              ? {
                  'x-vercel-protection-bypass':
                    process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
                }
              : undefined,
          });
        })
      );
    }

    return {
      sequenceId: input.sequenceId,
      frameCount,
      message:
        input.options?.generateThumbnails !== false
          ? `Created ${frameCount} frames. Thumbnail generation is in progress.`
          : `Created ${frameCount} frames.`,
    };
  },
  {
    retries: 3,
    retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
  }
);
