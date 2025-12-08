/**
 * Frame generation workflow
 * Orchestrates script analysis, frame creation, and thumbnail generation
 */

import { getEnv } from '#env';
import { characterSheetWorkflow } from '@/app/api/workflows/[...any]/character-sheet-workflow';
import { generateImageWorkflow } from '@/app/api/workflows/[...any]/image-workflow';
import { generateMotionWorkflow } from '@/app/api/workflows/[...any]/motion-workflow';
import { ProgressCallback } from '@/lib/ai/openrouter-client';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import {
  updateSequenceAnalysisDurationMs,
  updateSequenceMetadata,
  updateSequenceStatus,
  updateSequenceTitle,
  updateSequenceWorkflow,
} from '@/lib/db/helpers/sequences';
import { NewFrame, SequenceCharacter } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';
import {
  extractCharacterBible,
  generateAudioDesignForScenes,
  generateMotionPromptsForScenes,
  generateVisualPromptsForScenes,
  splitScriptIntoScenes,
} from '@/lib/script';
import { Scene } from '@/lib/script/types';
import {
  buildPromptWithReferences,
  createFromBible,
} from '@/lib/services/character.service';
import { frameService } from '@/lib/services/frame.service';
import type {
  AnalyzeScriptWorkflowInput,
  CharacterSheetWorkflowInput,
  ImageWorkflowInput,
  MotionWorkflowInput,
} from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { FlowControl } from '@upstash/qstash';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/nextjs';

// Total phases for realtime progress tracking
const TOTAL_PHASES = 7;

export const maxDuration = 800; // This function can run for a maximum of 800 seconds

// Helper to safely emit events (no-op if realtime unavailable)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emitSequenceEvent = async (
  sequenceId: string,
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
) => {
  if (!sequenceId) return;
  const channel = getGenerationChannel(sequenceId);
  if (!channel) return;
  try {
    await channel.emit(`generation.${event}` as 'generation.complete', data);
  } catch (error) {
    console.warn('[StoryboardGenerationWorkflow] Failed to emit event:', error);
  }
};

// ------------------------------------------------------------
// Process scenes in batches for phases 3-5
const BATCH_SIZE = 1; // Process this many scenes at a time

/**
 * Match characters to a scene by their continuity tags
 * Pure function that works in-memory without DB queries
 */
function matchCharactersToScene(
  allCharacters: SequenceCharacter[],
  characterTags: string[]
): SequenceCharacter[] {
  if (characterTags.length === 0) return [];

  return allCharacters.filter((char) => {
    const metadata = char.metadata;
    const consistencyTag = metadata.consistencyTag.toLowerCase();
    const charName = char.name.toLowerCase();

    return characterTags.some((tag) => {
      const tagLower = tag.toLowerCase();
      return (
        tagLower.includes(consistencyTag) ||
        tagLower.includes(charName) ||
        tagLower.includes(metadata.characterId.toLowerCase())
      );
    });
  });
}

export const analyzeScriptWorkflow = createWorkflow(
  async (context: WorkflowContext<AnalyzeScriptWorkflowInput>) => {
    const input = context.requestPayload;

    const {
      sequenceId,
      script,
      aspectRatio,
      styleConfig,
      analysisModelId,
      imageModel,
      videoModel,
      autoGenerateMotion = false,
    } = input;

    // Helper to safely emit events (no-op if realtime unavailable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emit = async (event: string, data: any) => {
      if (!sequenceId) return;
      await emitSequenceEvent(sequenceId, event, data);
    };

    // Flow control for image and motion generation

    const runtimeEnv = getEnv();
    const falConcurrencyLimit = (
      runtimeEnv as unknown as Record<string, string>
    ).FAL_CONCURRENCY_LIMIT;
    const flowControl: FlowControl = {
      key: 'fal-requests', // Shared key for both image & motion
      rate: 10,
      period: '5s', // 5 seconds
      parallelism: falConcurrencyLimit ? parseInt(falConcurrencyLimit) : 10,
    };
    const vercelAutomationBypassSecret =
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

    const headers = vercelAutomationBypassSecret
      ? {
          'x-vercel-protection-bypass': vercelAutomationBypassSecret,
        }
      : undefined;

    // STEP: Split script into basic scenes and store in sequence metadata
    const { scenes, title, startTime } = await context.run(
      'split-script-into-scenes',
      async () => {
        const startTime = Date.now();

        if (!script) {
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
        }) => {};
        const result = await splitScriptIntoScenes(
          script,
          aspectRatio,
          splitScriptProgressCallback,
          { model: analysisModelId }
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
          startTime: startTime,
        };
      }
    );

    // Step 3: Update sequence with title add add basic frames. Return a map of scene ID to frame ID.
    const frameMapping: { sceneId: string; frameId: string }[] =
      await context.run('update-title-and-create-frames', async () => {
        if (!sequenceId) return [];

        // Add the updated metadata to the sequence
        await updateSequenceTitle(sequenceId, title);

        // Emit sequence updated event so frontend can refresh title
        await emit('updated', { title });

        // Add the workflow to the sequence
        await updateSequenceWorkflow(
          sequenceId,
          `analyze-script-shorter-prompts-batch-size-${BATCH_SIZE}`
        );

        // Build array of all frames to create with basic scene data
        const frameInserts = scenes.map(
          (scene, index) =>
            ({
              sequenceId,
              description: scene.originalScript.extract,
              orderIndex: index,
              metadata: scene, // Store BasicScene object - will be enriched later
              durationMs: Math.round(
                (scene.metadata.durationSeconds || 3) * 1000
              ),
              thumbnailStatus: 'generating', // we're going to generate the thumbnail
              videoStatus: autoGenerateMotion ? 'generating' : 'pending',
            }) satisfies NewFrame
        );

        // Bulk insert all frames at once
        const createdFrames = await frameService.bulkInsertFrames(frameInserts);

        // Create a map of scene ID to frame ID for later updates
        const frameMapping = createdFrames.map((frame) => ({
          sceneId: frame.metadata?.sceneId || '',
          frameId: frame.id,
        }));

        // Set sequence status to completed
        await updateSequenceStatus(sequenceId, 'completed');

        // Emit frame:created for each frame
        for (const { sceneId, frameId } of frameMapping) {
          const scene = scenes.find((s) => s.sceneId === sceneId);
          await emit('frame:created', {
            frameId,
            sceneId,
            orderIndex: scene?.sceneNumber ? scene.sceneNumber - 1 : 0,
          });
        }

        return frameMapping;
      });

    // ------------------------------------------------------------
    // Extract character bible from scenes
    const characterBible = await context.run(
      'extract-character-bible',
      async () => {
        const extractCharacterBibleProgressCallback: ProgressCallback =
          (progress: {
            type: 'chunk' | 'complete';
            text: string;
            parsed?: unknown;
          }) => {};

        // Emit Phase 2 start
        await emit('phase:start', {
          phase: 2,
          phaseName: 'Character Extraction',
          totalPhases: TOTAL_PHASES,
        });
        const characterBible = await extractCharacterBible(
          scenes,
          extractCharacterBibleProgressCallback,
          {
            model: analysisModelId,
          }
        );

        if (sequenceId) {
          // Store character bible in sequence metadata
          await updateSequenceMetadata(sequenceId, {
            characterBible,
          });
        }
        // Emit Phase 2 complete
        await emit('phase:complete', { phase: 2 });

        return characterBible;
      }
    );

    // Characters with completed sheets - populated after character sheet generation
    let charactersWithSheets: SequenceCharacter[] = [];

    if (sequenceId && characterBible.length > 0) {
      const seqCharacters = await context.run(
        'create-sequence-characters',
        async () => {
          // Create sequence_characters records from character bible
          const seqCharacters = await createFromBible(
            sequenceId,
            characterBible
          );

          console.log(
            '[AnalyzeScriptWorkflow]',
            `Created ${seqCharacters.length} sequence characters`
          );

          return seqCharacters;
        }
      );

      const characterSheetWorkflowResults = await Promise.all(
        seqCharacters.map(async (char) => {
          const sheetInput: CharacterSheetWorkflowInput = {
            userId: input.userId!,
            teamId: input.teamId!,
            sequenceId,
            characterDbId: char.id,
            characterName: char.name,
            characterMetadata: char.metadata,
            imageModel: imageModel,
          };

          const characterSheetWorkflowResult = await context.invoke(
            'character-sheet',
            {
              workflowRunId: char.id,
              workflow: characterSheetWorkflow,
              body: sheetInput,
              retries: 3,
              retryDelay: 'pow(2, retried) * 1000',
              flowControl,
              headers,
            }
          );
          return characterSheetWorkflowResult;
        })
      );

      // Merge character sheet results with seqCharacters to build charactersWithSheets
      // context.invoke returns { body, isFailed, isCanceled }
      charactersWithSheets = seqCharacters
        .map((char) => {
          const sheetResult = characterSheetWorkflowResults.find(
            (r) =>
              !r.isFailed && !r.isCanceled && r.body?.characterDbId === char.id
          );
          if (sheetResult?.body?.sheetImageUrl) {
            return {
              ...char,
              sheetImageUrl: sheetResult.body.sheetImageUrl,
              sheetStatus: 'completed' as const,
            };
          }
          return char;
        })
        .filter(
          (c): c is SequenceCharacter & { sheetImageUrl: string } =>
            !!c.sheetImageUrl
        );

      console.log(
        '[AnalyzeScriptWorkflow]',
        `Generated ${charactersWithSheets.length} character sheets from ${seqCharacters.length} characters`
      );
    }

    // Emit Phase 3 complete
    await emit('phase:complete', { phase: 3 });

    // Emit Phase 4 start
    await emit('phase:start', {
      phase: 4,
      phaseName: 'Visual Prompts',
      totalPhases: TOTAL_PHASES,
    });

    const basicSceneBatches: Scene[][] = scenes.reduce((acc, scene, index) => {
      const batchIndex = Math.floor(index / BATCH_SIZE);
      if (!acc[batchIndex]) {
        acc[batchIndex] = [];
      }
      acc[batchIndex].push(scene);
      return acc;
    }, [] as Scene[][]);

    // ------------------------------------------------------------
    // Step 5: Generate visual prompts for each batch
    const visualPromptResults: Scene[][] = await Promise.all(
      basicSceneBatches.map(async (batch, batchIndex) => {
        return context.run(`visual-prompts-batch-${batchIndex}`, async () => {
          const generateVisualPromptsProgressCallback: ProgressCallback =
            (progress: {
              type: 'chunk' | 'complete';
              text: string;
              parsed?: unknown;
            }) => {};
          return await generateVisualPromptsForScenes(
            batch,
            aspectRatio,
            characterBible,
            styleConfig,
            generateVisualPromptsProgressCallback,
            { model: analysisModelId }
          );
        });
      })
    );
    const scenesWithVisualPrompts = visualPromptResults.flat();
    if (sequenceId) {
      // Update frames with visual prompt data (Phase 3)
      await context.run('update-frames-after-visual-prompts', async () => {
        await Promise.all(
          scenesWithVisualPrompts.map(async (scene) => {
            const frame = frameMapping.find(
              (frame) => frame.sceneId === scene.sceneId
            );
            if (!frame) return;
            await frameService.updateFrame({
              id: frame.frameId,
              metadata: scene,
            });
            await emit('frame:updated', {
              frameId: frame.frameId,
              updateType: 'visual-prompt',
              metadata: scene,
            });
          })
        );

        // Emit Phase 4 complete
        await emit('phase:complete', { phase: 4 });
        // Emit Phase 5 start
        await emit('phase:start', {
          phase: 5,
          phaseName: 'Motion Prompts',
          totalPhases: TOTAL_PHASES,
        });
      });
    }
    let imageUrls: string[] = [];
    // Step 8: Generate thumbnails in parallel if enabled
    if (imageModel) {
      // Map aspect ratio to image size preset
      const imageSize = aspectRatioToImageSize(aspectRatio);

      // Build scene character map in-memory using characters from Phase 3
      const sceneCharacterMap: Record<string, SequenceCharacter[]> = {};
      for (const scene of scenesWithVisualPrompts) {
        const sceneCharTags = scene.continuity?.characterTags || [];
        sceneCharacterMap[scene.sceneId] = matchCharactersToScene(
          charactersWithSheets,
          sceneCharTags
        );
      }

      imageUrls = await Promise.all(
        scenesWithVisualPrompts.map(async (scene) => {
          // Check if visual prompt exists
          const visualPrompt = scene.prompts?.visual?.fullPrompt;
          if (!visualPrompt) {
            throw new WorkflowValidationError(
              `Scene ${scene.sceneId} has no visual prompt`
            );
          }

          // Optional: pass the frame ID to the image generation workflow
          const frame = frameMapping.find(
            (frame) => frame.sceneId === scene.sceneId
          );

          // Get characters for this scene and build enhanced prompt with references
          // sceneCharacterMap already contains only characters with completed sheets
          const charsWithSheets = sceneCharacterMap[scene.sceneId] || [];
          const { prompt: enhancedPrompt, referenceUrls } =
            buildPromptWithReferences(visualPrompt, charsWithSheets);

          // Generate image for the frame using sequence's selected model
          const imageInput: ImageWorkflowInput = {
            userId: input.userId,
            teamId: input.teamId,
            prompt: enhancedPrompt,
            model: imageModel,
            imageSize,
            numImages: 1,
            // Not required, but can be used to update the frame thumbnail
            frameId: frame?.frameId,
            sequenceId,
            // Pass character reference images for consistency
            referenceImageUrls: referenceUrls,
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
            flowControl,
            headers,
          });

          if (imageIsFailed || imageIsCanceled || !imageBody.imageUrl) {
            throw new WorkflowValidationError(
              `Image generation failed for scene ${scene.sceneId}, skipping motion generation`
            );
          }
          return imageBody.imageUrl;
        })
      );
    }

    // Step 6: Generate motion prompts for each batch
    const motionPromptResults: Scene[][] = await Promise.all(
      visualPromptResults.map(async (batchWithVisualPrompts, batchIndex) => {
        return context.run(`motion-prompts-batch-${batchIndex}`, async () => {
          const generateMotionPromptsProgressCallback: ProgressCallback =
            (progress: {
              type: 'chunk' | 'complete';
              text: string;
              parsed?: unknown;
            }) => {};
          return await generateMotionPromptsForScenes(
            batchWithVisualPrompts,
            generateMotionPromptsProgressCallback,
            {
              model: analysisModelId,
            }
          );
        });
      })
    );

    const scenesWithMotionPrompts = motionPromptResults.flat();

    if (sequenceId) {
      // Update frames with motion prompt data (Phase 4)
      await context.run('update-frames-after-motion-prompts', async () => {
        await Promise.all(
          scenesWithMotionPrompts.map(async (scene) => {
            const frame = frameMapping.find(
              (frame) => frame.sceneId === scene.sceneId
            );
            if (!frame) return;
            await frameService.updateFrame({
              id: frame.frameId,
              metadata: scene,
            });
            await emit('frame:updated', {
              frameId: frame.frameId,
              updateType: 'motion-prompt',
              metadata: scene,
            });
          })
        );

        // Emit Phase 5 complete
        await emit('phase:complete', { phase: 5 });
        // Emit Phase 6 start
        await emit('phase:start', {
          phase: 6,
          phaseName: 'Audio Design',
          totalPhases: TOTAL_PHASES,
        });
      });
    }
    // Step 7: Generate audio design for each batch
    const audioDesignResults: Scene[][] = await Promise.all(
      motionPromptResults.map(async (batchWithMotionPrompts, batchIndex) => {
        return context.run(`audio-design-batch-${batchIndex}`, async () => {
          const generateAudioDesignProgressCallback: ProgressCallback =
            (progress: {
              type: 'chunk' | 'complete';
              text: string;
              parsed?: unknown;
            }) => {};

          return await generateAudioDesignForScenes(
            batchWithMotionPrompts,
            generateAudioDesignProgressCallback,
            {
              model: analysisModelId,
            }
          );
        });
      })
    );

    const completeScenes = audioDesignResults.flat();
    if (sequenceId) {
      // Update frames with audio design data (Phase 5)
      await context.run('update-frames-after-audio-design', async () => {
        await Promise.all(
          completeScenes.map(async (scene) => {
            const frame = frameMapping.find(
              (frame) => frame.sceneId === scene.sceneId
            );
            if (!frame) return;
            await frameService.updateFrame({
              id: frame.frameId,
              metadata: scene,
            });
            await emit('frame:updated', {
              frameId: frame.frameId,
              updateType: 'audio-design',
              metadata: scene,
            });
          })
        );

        await updateSequenceAnalysisDurationMs(
          sequenceId,
          Date.now() - startTime
        );
        // Emit Phase 6 complete
        await emit('phase:complete', { phase: 6 });

        // Emit Phase 7 start (Image Generation)
        await emit('phase:start', {
          phase: 7,
          phaseName: 'Image & Motion Generation',
          totalPhases: TOTAL_PHASES,
        });
      });
    }

    if (videoModel && imageUrls && imageUrls.length > 0) {
      // Generate motion for each scene
      await Promise.all(
        completeScenes.map(async (scene, index) => {
          // Check if visual prompt exists
          const visualPrompt = scene.prompts?.visual?.fullPrompt;
          if (!visualPrompt) {
            throw new WorkflowValidationError(
              `Scene ${scene.sceneId} has no visual prompt`
            );
          }

          // Optional: pass the frame ID to the image generation workflow
          const frame = frameMapping.find(
            (frame) => frame.sceneId === scene.sceneId
          );
          // ------------------------------------------------------------
          // Generate motion for the frame using sequence's selected model
          // ------------------------------------------------------------
          if (!autoGenerateMotion || !videoModel) {
            // Auto-generate motion is disabled or no video model selected, skip motion generation
            return;
          }
          // Check if motion prompt exists
          const motionPrompt = scene.prompts?.motion?.fullPrompt;
          if (!motionPrompt) {
            throw new WorkflowValidationError(
              `Scene ${scene.sceneId} has no motion prompt`
            );
          }

          // Trigger motion generation workflow using sequence's selected model
          const motionInput: MotionWorkflowInput = {
            userId: input.userId,
            teamId: input.teamId,
            frameId: frame?.frameId,
            sequenceId,
            imageUrl: imageUrls[index],
            prompt: motionPrompt,
            model: videoModel,
            aspectRatio,
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
  },
  {
    retries: 3,
    retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;
      const { sequenceId } = input;
      if (!sequenceId) return;

      console.error('[AnalyzeScriptWorkflow] Failure:', failResponse);

      // Set sequence status to completed
      await updateSequenceStatus(sequenceId, 'failed');

      // Emit sequence failure event
      await emitSequenceEvent(sequenceId, 'failed', {
        message: String(failResponse),
      });

      return `Analysis workflow failed: ${failResponse}`;
    },
  }
);
