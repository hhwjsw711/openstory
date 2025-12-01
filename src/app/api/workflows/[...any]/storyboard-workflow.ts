/**
 * Frame generation workflow
 * Orchestrates script analysis, frame creation, and thumbnail generation
 */

import { getDb } from '#db-client';
import { getEnv } from '#env';
import { generateImageWorkflow } from '@/app/api/workflows/[...any]/image-workflow';
import { generateMotionWorkflow } from '@/app/api/workflows/[...any]/motion-workflow';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  safeImageToVideoModel,
  safeTextToImageModel,
} from '@/lib/ai/models';
import { ProgressCallback } from '@/lib/ai/openrouter-client';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import { updateSequenceMetadata } from '@/lib/db/helpers/sequences';
import { sequences, styles } from '@/lib/db/schema';
import { Sequence } from '@/lib/db/schema/sequences';
import { getGenerationChannel } from '@/lib/realtime';
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
import { FlowControl } from '@upstash/qstash';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/nextjs';
import { eq } from 'drizzle-orm';

// Total phases for realtime progress tracking
const TOTAL_PHASES = 6;

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

    // Get realtime channel for this sequence (for streaming progress to client)
    // Note: This may fail if Redis env vars are not set, which is fine - we just skip realtime
    let channel: ReturnType<typeof getGenerationChannel> | null = null;
    try {
      channel = getGenerationChannel(input.sequenceId);
    } catch (error) {
      console.warn(
        '[StoryboardGenerationWorkflow] Realtime not available:',
        error
      );
    }

    // Helper to safely emit events (no-op if realtime unavailable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emit = async (event: string, data: any) => {
      if (!channel) return;
      try {
        console.log('emitting event', event, data);
        await channel.emit(
          `generation.${event}` as 'generation.complete',
          data
        );
      } catch (error) {
        console.warn(
          '[StoryboardGenerationWorkflow] Failed to emit event:',
          error
        );
      }
    };

    // Step 1: Verify sequence and get data
    const { sequence, styleConfig, analysisModel, imageModel, videoModel } =
      await context.run('verify-clear-and-start-processing', async () => {
        const sequence = await getDb().query.sequences.findFirst({
          where: eq(sequences.id, input.sequenceId),
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

        const style = await getDb().query.styles.findFirst({
          where: eq(styles.id, sequence.styleId),
        });

        if (!style) {
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
        await getDb()
          .update(sequences)
          .set({ status: 'processing', updatedAt: new Date() })
          .where(eq(sequences.id, input.sequenceId));

        const styleConfig = DirectorDnaConfigSchema.parse(style.config);

        // Use the sequence's models (fall back to defaults if not set)
        // Runtime validation prevents invalid model keys from causing downstream failures
        const analysisModel =
          sequence.analysisModel || 'anthropic/claude-haiku-4.5';
        const imageModel = safeTextToImageModel(
          sequence.imageModel,
          DEFAULT_IMAGE_MODEL
        );
        const videoModel = safeImageToVideoModel(
          sequence.videoModel,
          DEFAULT_VIDEO_MODEL
        );

        return { sequence, styleConfig, analysisModel, imageModel, videoModel };
      });

    // Step 2: Split script into basic scenes and store in sequence metadata
    const { scenes: basicScenes, title } = await context.run(
      'split-script-into-scenes',
      async () => {
        if (!sequence.script) {
          throw new WorkflowValidationError('No script found');
        }

        // Emit Phase 1 start
        await emit('phase:start', {
          phase: 1,
          phaseName: 'Scene Splitting',
          totalPhases: TOTAL_PHASES,
        });

        const splitScriptProgressCallback: ProgressCallback = (progress: {
          type: 'chunk' | 'complete';
          text: string;
          parsed?: unknown;
        }) => {
          console.log(
            '[StoryboardGenerationWorkflow] Split Script Progress:',
            progress.type
          );
        };
        const result = await splitScriptIntoScenes(
          sequence.script,
          sequence.aspectRatio,
          splitScriptProgressCallback,
          { model: analysisModel }
        );

        if (!result.scenes || result.scenes.length === 0) {
          throw new WorkflowValidationError(
            'Script splitting returned no scenes - script may be too short or invalid'
          );
        }

        // Emit scene:new for each scene that was split
        for (const scene of result.scenes) {
          await emit('scene:new', {
            sceneId: scene.sceneId,
            sceneNumber: scene.sceneNumber,
            title: scene.metadata.title,
            scriptExtract: scene.originalScript.extract,
            durationSeconds: scene.metadata.durationSeconds,
          });
        }

        // Emit Phase 1 complete
        await emit('phase:complete', { phase: 1 });

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

        await getDb()
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
        const frameMapping = createdFrames.map((frame) => ({
          sceneId: frame.metadata?.sceneId || '',
          frameId: frame.id,
        }));

        // Emit frame:created for each frame
        for (const { sceneId, frameId } of frameMapping) {
          const scene = basicScenes.find((s) => s.sceneId === sceneId);
          await emit('frame:created', {
            frameId,
            sceneId,
            orderIndex: scene?.sceneNumber ? scene.sceneNumber - 1 : 0,
          });
        }

        return frameMapping;
      }
    );

    // Step 4: Extract character bible
    const characterBible = await context.run(
      'extract-character-bible',
      async () => {
        const extractCharacterBibleProgressCallback: ProgressCallback =
          (progress: {
            type: 'chunk' | 'complete';
            text: string;
            parsed?: unknown;
          }) => {
            console.log(
              '[StoryboardGenerationWorkflow] Extract Character Bible Progress:',
              progress.type
            );
          };

        // Emit Phase 2 start
        await emit('phase:start', {
          phase: 2,
          phaseName: 'Character Extraction',
          totalPhases: TOTAL_PHASES,
        });
        const characterBible = await extractCharacterBible(
          basicScenes,
          extractCharacterBibleProgressCallback,
          {
            model: analysisModel,
          }
        );

        // Store character bible in sequence metadata
        await updateSequenceMetadata(input.sequenceId, {
          characterBible,
        });

        // Set sequence status to completed
        await getDb()
          .update(sequences)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(sequences.id, input.sequenceId));

        // Emit Phase 2 complete
        await emit('phase:complete', { phase: 2 });

        // Emit Phase 3 start
        await emit('phase:start', {
          phase: 3,
          phaseName: 'Visual Prompts',
          totalPhases: TOTAL_PHASES,
        });
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
          const generateVisualPromptsProgressCallback: ProgressCallback =
            (progress: {
              type: 'chunk' | 'complete';
              text: string;
              parsed?: unknown;
            }) => {
              console.log(
                '[StoryboardGenerationWorkflow] Generate Visual Prompts Progress:',
                progress.type
              );
            };
          return await generateVisualPromptsForScenes(
            batch,
            characterBible,
            styleConfig,
            generateVisualPromptsProgressCallback,
            { model: analysisModel }
          );
        });
      })
    );

    // Update frames with visual prompt data (Phase 3)
    await context.run('update-frames-after-visual-prompts', async () => {
      const scenes = visualPromptResults.flat();

      await Promise.all(
        scenes.map(async (scene) => {
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

      // Emit frame:updated for each frame with visual prompts
      for (const scene of scenes) {
        const frameMapping = frameMap.find((m) => m.sceneId === scene.sceneId);
        if (frameMapping) {
          await emit('frame:updated', {
            frameId: frameMapping.frameId,
            updateType: 'visual-prompt',
            metadata: scene,
          });
        }
      }

      // Emit Phase 3 complete
      await emit('phase:complete', { phase: 3 });

      return scenes;
    });

    // Step 6: Generate motion prompts for each batch
    const motionPromptResults: Scene[][] = await Promise.all(
      visualPromptResults.map(async (batchWithVisualPrompts, batchIndex) => {
        return context.run(`motion-prompts-batch-${batchIndex}`, async () => {
          // Emit Phase 4 start
          await emit('phase:start', {
            phase: 4,
            phaseName: 'Motion Prompts',
            totalPhases: TOTAL_PHASES,
          });
          const generateMotionPromptsProgressCallback: ProgressCallback =
            (progress: {
              type: 'chunk' | 'complete';
              text: string;
              parsed?: unknown;
            }) => {
              console.log(
                '[StoryboardGenerationWorkflow] Generate Motion Prompts Progress:',
                progress.type
              );
            };
          return await generateMotionPromptsForScenes(
            batchWithVisualPrompts,
            generateMotionPromptsProgressCallback,
            {
              model: analysisModel,
            }
          );
        });
      })
    );

    // Update frames with motion prompt data (Phase 4)
    await context.run('update-frames-after-motion-prompts', async () => {
      const scenes = motionPromptResults.flat();

      await Promise.all(
        scenes.map(async (scene) => {
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

      // Emit Phase 4 complete
      await emit('phase:complete', { phase: 4 });
    });

    // Step 7: Generate audio design for each batch
    const audioDesignResults: Scene[][] = await Promise.all(
      motionPromptResults.map(async (batchWithMotionPrompts, batchIndex) => {
        return context.run(`audio-design-batch-${batchIndex}`, async () => {
          const generateAudioDesignProgressCallback: ProgressCallback =
            (progress: {
              type: 'chunk' | 'complete';
              text: string;
              parsed?: unknown;
            }) => {
              console.log(
                '[StoryboardGenerationWorkflow] Generate Audio Design Progress:',
                progress.type
              );
            };

          // Emit Phase 5 start
          await emit('phase:start', {
            phase: 5,
            phaseName: 'Audio Design',
            totalPhases: TOTAL_PHASES,
          });
          return await generateAudioDesignForScenes(
            batchWithMotionPrompts,
            generateAudioDesignProgressCallback,
            {
              model: analysisModel,
            }
          );
        });
      })
    );

    // Update frames with audio design data (Phase 5)
    const completeScenes: Scene[] = await context.run(
      'update-frames-after-audio-design',
      async () => {
        const scenes = audioDesignResults.flat();

        await Promise.all(
          scenes.map(async (scene) => {
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

        // Emit frame:updated for each frame with audio design
        for (const scene of scenes) {
          const frameMapping = frameMap.find(
            (m) => m.sceneId === scene.sceneId
          );
          if (frameMapping) {
            await emit('frame:updated', {
              frameId: frameMapping.frameId,
              updateType: 'audio-design',
              metadata: scene,
            });
          }
        }

        // Emit Phase 5 complete
        await emit('phase:complete', { phase: 5 });

        // Emit Phase 6 start (Image Generation)
        await emit('phase:start', {
          phase: 6,
          phaseName: 'Image & Motion Generation',
          totalPhases: TOTAL_PHASES,
        });

        return scenes;
      }
    );

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

          // Generate image for the frame using sequence's selected model
          const imageInput: ImageWorkflowInput = {
            userId: input.userId,
            teamId: input.teamId,
            prompt: visualPrompt,
            model: imageModel,
            imageSize,
            numImages: 1,
            frameId,
            sequenceId: input.sequenceId,
          };
          const runtimeEnv = getEnv();
          const falConcurrencyLimit = (
            runtimeEnv as unknown as Record<string, string>
          ).FAL_CONCURRENCY_LIMIT;
          const flowControl: FlowControl = {
            key: 'fal-requests', // Shared key for both image & motion
            rate: 10,
            period: '5s', // 5 seconds
            parallelism: falConcurrencyLimit
              ? parseInt(falConcurrencyLimit)
              : 10,
          };
          const vercelAutomationBypassSecret =
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

          const headers = vercelAutomationBypassSecret
            ? {
                'x-vercel-protection-bypass': vercelAutomationBypassSecret,
              }
            : undefined;
          const {
            body: imageBody,
            isFailed: imageIsFailed,
            isCanceled: imageIsCanceled,
          } = await context.invoke('image', {
            workflow: generateImageWorkflow,
            body: imageInput,
            retries: 3,
            retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
            flowControl,
            headers,
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

          // Trigger motion generation workflow using sequence's selected model
          const motionInput: MotionWorkflowInput = {
            userId: input.userId,
            teamId: input.teamId,
            frameId,
            sequenceId: input.sequenceId,
            thumbnailPath: imageBody.thumbnailPath,
            prompt: motionPrompt,
            model: videoModel,
            aspectRatio: sequence.aspectRatio,
          };

          await context.invoke('motion', {
            workflow: generateMotionWorkflow,
            body: motionInput,
            retries: 3,
            retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
            flowControl,
            headers,
          });
        })
      );
    }

    // Emit generation complete
    await context.run('emit-complete', async () => {
      await emit('complete', {
        sequenceId: input.sequenceId,
        frameCount,
      });
    });

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
