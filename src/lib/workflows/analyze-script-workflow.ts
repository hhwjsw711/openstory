/**
 * Frame generation workflow
 * Orchestrates script analysis, frame creation, and thumbnail generation
 */

import { generateImageWorkflow } from '@/lib/workflows/image-workflow';
import { generateMotionWorkflow } from '@/lib/workflows/motion-workflow';
import type { ProgressCallback } from '@/lib/ai/openrouter-client';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import {
  updateSequenceAnalysisDurationMs,
  updateSequenceStatus,
  updateSequenceTitle,
  updateSequenceWorkflow,
} from '@/lib/db/helpers/sequences';
import type { NewFrame } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';
import { extractCharacterBible } from '@/lib/script/character-extraction';
import { generateAudioDesignForScenes } from '@/lib/script/audio-design';
import { generateMotionPromptsForScenes } from '@/lib/script/motion-prompts';
import { splitScriptIntoScenes } from '@/lib/script/scene-splitting';
import type { Scene } from '@/lib/script/types';
import { buildCharacterReferenceImages } from '@/lib/prompts/character-prompt';
import { bulkInsertFrames, updateFrame } from '@/lib/db/helpers/frames';
import { matchTalentToCharacters } from '@/lib/services/talent-matching.service';
import { getTalentByIds } from '@/lib/db/helpers/talent';
import type {
  AnalyzeScriptWorkflowInput,
  ImageWorkflowInput,
  MotionWorkflowInput,
  TalentCharacterMatch,
} from '@/lib/workflow/types';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { withSequenceSession } from '@/lib/observability/langfuse';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { characterBibleWorkflow } from './character-bible-workflow';
import type { CharacterMinimal } from '@/lib/db/schema';
import { visualPromptWorkflow } from './visual-prompt-workflow';

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

    // Wrap entire workflow in Langfuse session context for trace grouping
    // Skip session wrapping if no sequenceId (shouldn't happen in practice)
    const runWorkflow = async () => {
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

      // STEP: Split script into basic scenes and store in sequence metadata
      const { scenes, title, startTime } = await context.run(
        'split-script-into-scenes',
        async () => {
          const startTime = Date.now();

          if (!script) {
            throw new WorkflowValidationError('No script found');
          }

          // Emit Phase 1 start
          await getGenerationChannel(sequenceId).emit(
            'generation.phase:start',
            {
              phase: 1,
              phaseName: 'Scene Splitting',
            }
          );

          const splitScriptProgressCallback: ProgressCallback = () => {};
          const result = await splitScriptIntoScenes(
            script,
            aspectRatio,
            splitScriptProgressCallback,
            {
              model: analysisModelId,
            }
          );

          if (!result.scenes || result.scenes.length === 0) {
            throw new WorkflowValidationError(
              'Script splitting returned no scenes - script may be too short or invalid'
            );
          }

          // Emit scene:new for each scene that was split
          for (const scene of result.scenes) {
            await getGenerationChannel(sequenceId).emit(
              'generation.scene:new',
              {
                sceneId: scene.sceneId,
                sceneNumber: scene.sceneNumber,
                title: scene.metadata?.title || 'Untitled Scene',
                scriptExtract: scene.originalScript?.extract || '',
                durationSeconds: scene.metadata?.durationSeconds || 3,
              }
            );
          }

          // Emit Phase 1 complete
          await getGenerationChannel(sequenceId).emit(
            'generation.phase:complete',
            { phase: 1 }
          );

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

      // ------------------------------------------------------------
      // Extract character bible from scenes
      const characterBible = await context.run(
        'extract-character-bible',
        async () => {
          const extractCharacterBibleProgressCallback: ProgressCallback =
            () => {};

          // Emit Phase 2 start
          await getGenerationChannel(sequenceId).emit(
            'generation.phase:start',
            {
              phase: 2,
              phaseName: 'Character Extraction',
            }
          );
          const characterBible = await extractCharacterBible(
            scenes,
            extractCharacterBibleProgressCallback,
            {
              model: analysisModelId,
            }
          );

          // Emit Phase 2 complete
          await getGenerationChannel(sequenceId).emit(
            'generation.phase:complete',
            { phase: 2 }
          );

          // Start phase 3

          return characterBible;
        }
      );

      // ------------------------------------------------------------
      // Match suggested talent to extracted characters (if provided)
      const talentMatches: TalentCharacterMatch[] = await context.run(
        'match-talent-to-characters',
        async () => {
          console.log('[TalentMatching] Starting talent matching step');
          console.log(
            '[TalentMatching] suggestedTalentIds:',
            suggestedTalentIds
          );
          console.log('[TalentMatching] teamId:', input.teamId);
          console.log(
            '[TalentMatching] characterBible count:',
            characterBible.length
          );

          // Skip if no suggested talent
          if (
            !suggestedTalentIds ||
            suggestedTalentIds.length === 0 ||
            !input.teamId
          ) {
            console.log(
              '[TalentMatching] Skipping - no suggested talent or teamId'
            );
            return [];
          }

          // Fetch suggested talent with their default sheets
          const talentList = await getTalentByIds(
            suggestedTalentIds,
            input.teamId
          );

          console.log(
            '[TalentMatching] Fetched talent count:',
            talentList.length
          );
          console.log(
            '[TalentMatching] Talent details:',
            talentList.map((t) => ({
              id: t.id,
              name: t.name,
              hasDefaultSheet: !!t.defaultSheet,
              defaultSheetImageUrl: t.defaultSheet?.imageUrl,
              defaultSheetHasMetadata: !!t.defaultSheet?.metadata,
            }))
          );

          if (talentList.length === 0) {
            console.log('[TalentMatching] No talent fetched from DB');
            return [];
          }

          // Match talent to characters using AI
          const matchResult = await matchTalentToCharacters(
            characterBible,
            talentList,
            { model: analysisModelId }
          );

          console.log('[TalentMatching] Match result:', {
            matchCount: matchResult.matches.length,
            matches: matchResult.matches.map((m) => ({
              charId: m.characterId,
              talentName: m.talentName,
            })),
            unusedCount: matchResult.unusedTalentIds.length,
            unusedNames: matchResult.unusedTalentNames,
          });

          // Emit matched talent event
          if (matchResult.matches.length > 0) {
            await getGenerationChannel(sequenceId).emit(
              'generation.talent:matched',
              {
                matches: matchResult.matches.map((m) => {
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

          // Emit unused talent event
          if (matchResult.unusedTalentIds.length > 0) {
            await getGenerationChannel(sequenceId).emit(
              'generation.talent:unmatched',
              {
                unusedTalentIds: matchResult.unusedTalentIds,
                unusedTalentNames: matchResult.unusedTalentNames,
              }
            );
          }

          return matchResult.matches;
        }
      );

      // Characters with completed sheets - populated after character sheet generation
      const [
        { body: charactersWithSheets },
        { body: scenesWithVisualPrompts },
      ] = await Promise.all([
        context.invoke('character-sheet-from-bible', {
          workflow: characterBibleWorkflow,
          body: {
            sequenceId,
            userId: input.userId,
            teamId: input.teamId,
            characterBible,
            talentMatches,
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
          await getGenerationChannel(sequenceId).emit(
            'generation.phase:start',
            {
              phase: 5,
              phaseName: 'Generate Images',
            }
          );
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

      // End phase 5, start phase 6
      await context.run('frame-images-complete', async () => {
        await getGenerationChannel(sequenceId).emit(
          'generation.phase:complete',
          {
            phase: 5,
          }
        );

        await getGenerationChannel(sequenceId).emit('generation.phase:start', {
          phase: 6,
          phaseName: 'Motion Prompts',
        });
      });

      // Step 6: Generate motion prompts for each batch
      const motionPromptResults: Scene[][] = await Promise.all(
        scenesWithVisualPrompts.map(async (scene, batchIndex) => {
          return context.run(`motion-prompts-batch-${batchIndex}`, async () => {
            const generateMotionPromptsProgressCallback: ProgressCallback =
              () => {};
            return await generateMotionPromptsForScenes(
              [scene],
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
      await context.run('motion-prompts-complete', async () => {
        await getGenerationChannel(sequenceId).emit(
          'generation.phase:complete',
          {
            phase: 6,
          }
        );
        await getGenerationChannel(sequenceId).emit('generation.phase:start', {
          phase: 7,
          phaseName: 'Audio Design',
        });
      });
      // Step 7: Generate audio design for each batch
      const audioDesignResults: Scene[][] = await Promise.all(
        motionPromptResults.map(async (batchWithMotionPrompts, batchIndex) => {
          return context.run(`audio-design-batch-${batchIndex}`, async () => {
            const generateAudioDesignProgressCallback: ProgressCallback =
              () => {};

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

          await getGenerationChannel(sequenceId).emit(
            'generation.phase:complete',
            {
              phase: 6,
            }
          );
        });
      }

      if (videoModel && imageUrls && imageUrls.length > 0) {
        // Start phase 7
        await context.run('start-motion-generation', async () => {
          await getGenerationChannel(sequenceId).emit(
            'generation.phase:start',
            {
              phase: 7,
              phaseName: 'Motion Generation',
            }
          );
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
    };

    // Wrap in session context if sequenceId is available
    if (input.sequenceId) {
      return withSequenceSession(input.sequenceId, input.userId, runWorkflow);
    }
    return runWorkflow();
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
