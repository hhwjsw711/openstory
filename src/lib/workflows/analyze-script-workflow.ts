/**
 * Frame generation workflow
 * Orchestrates script analysis, frame creation, and thumbnail generation
 */

import { generateImageWorkflow } from '@/lib/workflows/image-workflow';
import { generateMotionWorkflow } from '@/lib/workflows/motion-workflow';
import { sanitizeScriptContent } from '@/lib/ai/prompt-validation';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import {
  updateSequenceAnalysisDurationMs,
  updateSequenceStatus,
  updateSequenceTitle,
  updateSequenceWorkflow,
} from '@/lib/db/helpers/sequences';
import type { NewFrame } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';
import { characterExtractionResultSchema } from '@/lib/script/character-extraction';
import { audioDesignGenerationResultSchema } from '@/lib/script/audio-design';
import { motionPromptGenerationResultSchema } from '@/lib/script/motion-prompts';
import { sceneSplittingResultSchema } from '@/lib/script/scene-splitting';
import type { Scene } from '@/lib/script/types';
import type { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';
import { buildCharacterReferenceImages } from '@/lib/prompts/character-prompt';
import { bulkInsertFrames, updateFrame } from '@/lib/db/helpers/frames';
import {
  buildMatchingPromptVariables,
  talentMatchResponseSchema,
  buildMatchingPrompt,
} from '@/lib/services/talent-matching.service';
import { getTalentByIds } from '@/lib/db/helpers/talent';
import type {
  AnalyzeScriptWorkflowInput,
  ImageWorkflowInput,
  MotionWorkflowInput,
  TalentCharacterMatch,
} from '@/lib/workflow/types';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import {
  type PromptReference,
  logGeneration,
  recordWorkflowTrace,
} from '@/lib/observability/langfuse';
import { getPrompt } from '@/lib/observability/langfuse-prompts';
import { getEnv } from '#env';
import { z } from 'zod';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { characterBibleWorkflow } from './character-bible-workflow';
import type { CharacterMinimal } from '@/lib/db/schema';
import { visualPromptWorkflow } from './visual-prompt-workflow';
import { durableLLMCall } from './llm-call-helper';

// ------------------------------------------------------------
// Process scenes in batches for phases 3-5
const BATCH_SIZE = 1; // Process this many scenes at a time

/**
 * Match characters to a scene by their continuity tags
 * Pure function that works in-memory without DB queries
 */
function matchCharactersToScene(
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
      suggestedTalentIds,
    } = input;

    // ============================================================
    // PHASE 1: Scene Splitting (using durableLLMCall helper)
    // ============================================================

    // Validate input before calling
    if (!script) {
      throw new WorkflowValidationError('No script found');
    }

    const startTime = await context.run('start-time', async () => {
      return Date.now();
    });

    const {
      scenes,
      projectMetadata: { title },
    } = await durableLLMCall(
      context,
      {
        name: 'scene-splitting',
        phase: { number: 1, name: 'Scene Splitting' },

        promptName: 'velro/phase/scene-splitting-chat',
        promptVariables: {
          aspectRatio,
          script: sanitizeScriptContent(script),
        },

        modelId: analysisModelId,
        responseSchema: sceneSplittingResultSchema,
      },
      { sequenceId, userId: input.userId }
    );

    // Step 3: Update sequence with title add add basic frames. Return a map of scene ID to frame ID.
    const frameMapping: { sceneId: string; frameId: string }[] =
      await context.run('update-title-and-create-frames', async () => {
        for (const scene of scenes) {
          await getGenerationChannel(sequenceId).emit('generation.scene:new', {
            sceneId: scene.sceneId,
            sceneNumber: scene.sceneNumber,
            title: scene.metadata?.title || 'Untitled Scene',
            scriptExtract: scene.originalScript?.extract || '',
            durationSeconds: scene.metadata?.durationSeconds || 3,
          });
        }

        if (!sequenceId) return [];

        // Add the updated metadata to the sequence
        await updateSequenceTitle(sequenceId, title);

        // Emit sequence updated event so frontend can refresh title
        await getGenerationChannel(sequenceId).emit('generation.updated', {
          title,
        });

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
              description: scene.originalScript?.extract || '',
              orderIndex: index,
              metadata: scene, // Store BasicScene object - will be enriched later
              durationMs: Math.round(
                (scene.metadata?.durationSeconds || 3) * 1000
              ),
              thumbnailStatus: 'generating', // we're going to generate the thumbnail
              videoStatus: autoGenerateMotion ? 'generating' : 'pending',
            }) satisfies NewFrame
        );

        // Bulk insert all frames at once
        const createdFrames = await bulkInsertFrames(frameInserts);

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
          await getGenerationChannel(sequenceId).emit(
            'generation.frame:created',
            {
              frameId,
              sceneId,
              orderIndex: scene?.sceneNumber ? scene.sceneNumber - 1 : 0,
            }
          );
        }

        return frameMapping;
      });

    // ============================================================
    // PHASE 2: Character Extraction (using durableLLMCall helper)
    // ============================================================

    const { characterBible } = await durableLLMCall(
      context,
      {
        name: 'character-extraction',
        phase: { number: 2, name: 'Character Extraction' },

        promptName: 'velro/phase/character-extraction-chat',
        promptVariables: {
          scenes: JSON.stringify(scenes, null, 2),
        },

        modelId: analysisModelId,
        responseSchema: characterExtractionResultSchema,
      },
      { sequenceId, userId: input.userId }
    );

    // ============================================================
    // TALENT MATCHING (conditional three-step durable pattern)
    // ============================================================

    const { talentList, matchingPromptVariables } = await context.run(
      'get-talent-list',
      async () => {
        if (
          !suggestedTalentIds ||
          suggestedTalentIds.length === 0 ||
          !input.teamId
        ) {
          return { talentList: [], matchingPromptVariables: {} };
        }
        const talentList = await getTalentByIds(
          suggestedTalentIds,
          input.teamId
        );
        const matchingPromptVariables = buildMatchingPromptVariables(
          characterBible,
          talentList
        );

        return { talentList, matchingPromptVariables };
      }
    );

    // Call the talent matching LLM call

    const { matches: talentMatches } =
      talentList.length > 0
        ? await durableLLMCall(
            context,
            {
              name: 'talent-matching',
              phase: { number: 3, name: 'Talent Matching' },

              promptName: 'velro/phase/talent-matching-chat',
              promptVariables: matchingPromptVariables,
              modelId: analysisModelId,
              responseSchema: talentMatchResponseSchema,
            },
            { sequenceId, userId: input.userId }
          )
        : { matches: [] };

    const talentCharacterMatches: TalentCharacterMatch[] = await context.run(
      'build-matches',
      async () => {
        // Build match results
        const usedTalentIds = new Set<string>();
        const usedCharacterIds = new Set<string>();
        const matches: TalentCharacterMatch[] = [];

        for (const match of talentMatches) {
          // This ensures that talent is never cast twice
          if (usedTalentIds.has(match.talentId)) continue;
          // This ensures that a character is never cast twice
          if (usedCharacterIds.has(match.characterId)) continue;

          const talent = talentList.find((t) => t.id === match.talentId);
          if (!talent || !talent.imageUrl) continue;

          const character = characterBible.find(
            (c) => c.characterId === match.characterId
          );
          if (!character) continue;

          usedTalentIds.add(match.talentId);
          usedCharacterIds.add(match.characterId);
          matches.push({
            characterId: match.characterId,
            talentId: match.talentId,
            talentName: talent.name,
            sheetImageUrl: talent.defaultSheet?.imageUrl ?? '',
            sheetMetadata: talent.defaultSheet?.metadata ?? undefined,
          });
        }

        // Emit matched talent event
        if (matches.length > 0) {
          await getGenerationChannel(sequenceId).emit(
            'generation.talent:matched',
            {
              matches: matches.map((m) => {
                const char = characterBible.find(
                  (c) => c.characterId === m.characterId
                );
                return {
                  characterId: m.characterId,
                  characterName: char?.name ?? m.characterId,
                  talentId: m.talentId,
                  talentName: m.talentName,
                };
              }),
            }
          );
        }

        return matches;
      }
    );

    // Characters with completed sheets - populated after character sheet generation
    const [charResult, visualResult] = await Promise.all([
      context.invoke('character-sheet-from-bible', {
        workflow: characterBibleWorkflow,
        body: {
          sequenceId,
          userId: input.userId,
          teamId: input.teamId,
          characterBible,
          talentMatches: talentCharacterMatches,
        },
      }),
      context.invoke('visual-prompts', {
        workflow: visualPromptWorkflow,
        body: {
          sequenceId,
          scenes,
          aspectRatio,
          characterBible,
          styleConfig,
          analysisModelId,
          frameMapping,
        },
      }),
    ]);

    if (charResult.isFailed || charResult.isCanceled) {
      throw new Error('Character sheet generation failed');
    }
    if (visualResult.isFailed || visualResult.isCanceled) {
      throw new Error('Visual prompt generation failed');
    }

    const charactersWithSheets = charResult.body;
    const scenesWithVisualPrompts = visualResult.body;

    let imageUrls: string[] = [];
    // Step 8: Generate thumbnails in parallel if enabled
    if (imageModel) {
      // Map aspect ratio to image size preset
      const imageSize = aspectRatioToImageSize(aspectRatio);

      // Build scene character map in-memory using characters from Phase 3
      const sceneCharacterMap: Record<string, CharacterMinimal[]> = {};
      for (const scene of scenesWithVisualPrompts) {
        const sceneCharTags = scene.continuity?.characterTags || [];
        sceneCharacterMap[scene.sceneId] = matchCharactersToScene(
          charactersWithSheets,
          sceneCharTags
        );
      }
      // Start phase 5
      await context.run('frame-images-start', async () => {
        if (sequenceId) {
          // Time to first image
          await updateSequenceAnalysisDurationMs(
            sequenceId,
            Date.now() - startTime
          );
        }
        await getGenerationChannel(sequenceId).emit('generation.phase:start', {
          phase: 5,
          phaseName: 'Generate Images',
        });
      });
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

          // Generate image for the frame using sequence's selected model
          const imageInput: ImageWorkflowInput = {
            userId: input.userId,
            teamId: input.teamId,
            prompt: visualPrompt,
            model: imageModel,
            imageSize,
            numImages: 1,
            // Not required, but can be used to update the frame thumbnail
            frameId: frame?.frameId,
            sequenceId,
            // Pass character reference images for consistency
            referenceImages: buildCharacterReferenceImages(charsWithSheets),
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

    // End phase 5
    await context.run('frame-images-complete', async () => {
      await getGenerationChannel(sequenceId).emit('generation.phase:complete', {
        phase: 5,
      });
    });

    // ============================================================
    // PHASE 4: Motion Prompts (using durableLLMCall helper)
    // ============================================================

    const { scenes: partialScenesWithMotionPrompts } = await durableLLMCall(
      context,
      {
        name: 'motion-prompts',
        phase: { number: 6, name: 'Motion Prompts' },

        promptName: 'velro/phase/motion-prompt-generation-chat',
        promptVariables: {
          scenes: JSON.stringify(scenesWithVisualPrompts, null, 2),
        },

        modelId: analysisModelId,
        responseSchema: motionPromptGenerationResultSchema,

        additionalMetadata: {
          sceneCount: scenesWithVisualPrompts.length,
        },
        retryResponse: (validated) => {
          for (const scene of scenes) {
            const enrichment = validated.scenes.find(
              (s) => s.sceneId === scene.sceneId
            );
            if (!enrichment || !enrichment.prompts.motion.fullPrompt) {
              // Missing data, retry
              return true;
            }
          }
          // All data is present, no retry
          return false;
        },
      },
      { sequenceId, userId: input.userId }
    );

    const scenesWithMotionPrompts: Scene[] = await context.run(
      'merge-motion-prompts',
      async () => {
        return scenesWithVisualPrompts.map((scene) => {
          const enrichment = partialScenesWithMotionPrompts.find(
            (s) => s.sceneId === scene.sceneId
          );
          if (!enrichment) {
            throw new WorkflowValidationError(
              `Scene ID mismatch in motion prompts: expected "${scene.sceneId}"`
            );
          }

          return {
            ...scene,
            prompts: {
              visual: scene.prompts?.visual || {
                fullPrompt: '',
                negativePrompt: '',
                components: {
                  sceneDescription: '',
                  subject: '',
                  environment: '',
                  lighting: '',
                  camera: '',
                  composition: '',
                  style: '',
                  technical: '',
                  atmosphere: '',
                },
              },
              motion: enrichment.prompts.motion,
            },
          };
        });
      }
    );

    if (sequenceId) {
      // Update frames with motion prompt data (Phase 4)
      await context.run('update-frames-after-motion-prompts', async () => {
        await Promise.all(
          scenesWithMotionPrompts.map(async (scene) => {
            const frame = frameMapping.find(
              (frame) => frame.sceneId === scene.sceneId
            );
            if (!frame) return;
            await updateFrame(frame.frameId, {
              metadata: scene,
              motionPrompt: scene.prompts?.motion?.fullPrompt,
            });
            await getGenerationChannel(sequenceId).emit(
              'generation.frame:updated',
              {
                frameId: frame.frameId,
                updateType: 'motion-prompt',
                metadata: scene,
              }
            );
          })
        );
      });
    }

    // ============================================================
    // PHASE 5: Audio Design (using durableLLMCall helper)
    // ============================================================

    const { scenes: scenesWithAudioDesign } = await durableLLMCall(
      context,
      {
        name: 'audio-design',
        phase: { number: 7, name: 'Audio Design' },

        promptName: 'velro/phase/audio-design-chat',
        promptVariables: {
          scenes: JSON.stringify(scenesWithMotionPrompts, null, 2),
        },

        modelId: analysisModelId,
        responseSchema: audioDesignGenerationResultSchema,

        additionalMetadata: {
          sceneCount: scenesWithMotionPrompts.length,
        },
      },
      { sequenceId, userId: input.userId }
    );

    const completeScenes: Scene[] = await context.run(
      'merge-audio-design',
      async () => {
        return scenesWithMotionPrompts.map((scene) => {
          const enrichment = scenesWithAudioDesign.find(
            (s) => s.sceneId === scene.sceneId
          );
          if (!enrichment) {
            throw new WorkflowValidationError(
              `Scene ID mismatch in audio design: expected "${scene.sceneId}"`
            );
          }
          return {
            ...scene,
            audioDesign: enrichment.audioDesign,
          };
        });
      }
    );

    if (sequenceId) {
      // Update frames with audio design data (Phase 5)
      await context.run('update-frames-after-audio-design', async () => {
        await Promise.all(
          completeScenes.map(async (scene) => {
            const frame = frameMapping.find(
              (frame) => frame.sceneId === scene.sceneId
            );
            if (!frame) return;
            await updateFrame(frame.frameId, { metadata: scene });
            await getGenerationChannel(sequenceId).emit(
              'generation.frame:updated',
              {
                frameId: frame.frameId,
                updateType: 'audio-design',
                metadata: scene,
              }
            );
          })
        );
      });
    }

    if (autoGenerateMotion && videoModel && imageUrls && imageUrls.length > 0) {
      // Start phase 7
      await context.run('start-motion-generation', async () => {
        await getGenerationChannel(sequenceId).emit('generation.phase:start', {
          phase: 7,
          phaseName: 'Motion Generation',
        });
      });
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
            duration: scene.metadata?.durationSeconds || 3,
          };

          await context.invoke('motion', {
            workflow: generateMotionWorkflow,
            body: motionInput,
            retries: 3,
            retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
          });
        })
      );
    }

    // Record workflow trace as a durable step (only runs once at completion)
    if (sequenceId) {
      await context.run('record-workflow-trace', async () => {
        await recordWorkflowTrace(
          'analyzeScriptWorkflow',
          { script, styleConfig, aspectRatio },
          completeScenes,
          sequenceId,
          input.userId,
          analysisModelId,
          new Date(startTime)
        );
      });
    }

    return completeScenes;
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
      await getGenerationChannel(sequenceId).emit('generation.failed', {
        message: String(failResponse),
      });

      return `Analysis workflow failed: ${failResponse}`;
    },
  }
);
