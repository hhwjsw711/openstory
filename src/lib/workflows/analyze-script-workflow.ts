/**
 * Frame generation workflow
 * Orchestrates script analysis, frame creation, and thumbnail generation
 */

import { sanitizeScriptContent } from '@/lib/ai/prompt-validation';
import {
  musicDesignResultSchema,
  sceneSplittingResultSchema,
} from '@/lib/ai/response-schemas';
import type { Scene } from '@/lib/ai/scene-analysis.schema';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import type {
  CharacterMinimal,
  SequenceLocationMinimal,
} from '@/lib/db/schema';
import { recordWorkflowTrace } from '@/lib/observability/langfuse';
import { buildCharacterReferenceImages } from '@/lib/prompts/character-prompt';
import { buildLocationReferenceImages } from '@/lib/prompts/location-prompt';
import { getGenerationChannel } from '@/lib/realtime';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { sanitizeFailResponse } from '@/lib/workflow/sanitize-fail-response';
import type {
  AnalyzeScriptWorkflowInput,
  ImageWorkflowInput,
  MotionWorkflowInput,
  MusicWorkflowInput,
} from '@/lib/workflow/types';

import { DEFAULT_VIDEO_MODEL, IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';
import { snapDuration } from '@/lib/motion/motion-generation';
import { generateImageWorkflow } from '@/lib/workflows/image-workflow';
import { generateMotionWorkflow } from '@/lib/workflows/motion-workflow';
import { generateMusicWorkflow } from '@/lib/workflows/music-workflow';
import { characterBibleWorkflow } from './character-bible-workflow';
import { getFalFlowControl } from './constants';
import { durableLLMCall, durableStreamingSceneSplit } from './llm-call-helper';
import { locationBibleWorkflow } from './location-bible-workflow';
import { motionPromptWorkflow } from './motion-prompt-workflow';
import { reinforceInstrumentalTags } from './music-prompt.schema';

import { createScopedWorkflow } from '../workflow/scoped-workflow';
import { locationMatchingWorkflow } from './location-matching-workflow';
import { talentMatchingWorkflow } from './talent-matching-workflow';
import { visualPromptWorkflow } from './visual-prompt-workflow';

/**
 * Match characters to a scene by their continuity tags.
 * Pure function that works in-memory without DB queries.
 */
function matchCharactersToScene(
  allCharacters: CharacterMinimal[],
  characterTags: string[]
): CharacterMinimal[] {
  if (characterTags.length === 0) return [];

  return allCharacters.filter((char) => {
    const consistencyTag = (char.consistencyTag ?? '').toLowerCase();
    const charName = char.name.toLowerCase();
    const charId = char.characterId.toLowerCase();

    return characterTags.some((tag) => {
      const tagLower = tag.toLowerCase();
      return (
        (consistencyTag && tagLower.includes(consistencyTag)) ||
        tagLower.includes(charName) ||
        tagLower.includes(charId)
      );
    });
  });
}

/**
 * Match locations to a scene by environment tag or location name.
 * Pure function that works in-memory without DB queries.
 */
function matchLocationsToScene(
  allLocations: SequenceLocationMinimal[],
  environmentTag: string,
  sceneLocation: string
): SequenceLocationMinimal[] {
  if (!environmentTag && !sceneLocation) return [];

  const envTagLower = environmentTag.toLowerCase();
  const sceneLocLower = sceneLocation.toLowerCase();

  return allLocations.filter((loc) => {
    const consistencyTag = (loc.consistencyTag ?? '').toLowerCase();
    const locName = loc.name.toLowerCase();
    const locId = loc.locationId.toLowerCase();
    const searchTerms = [
      locName,
      locId,
      ...(consistencyTag ? [consistencyTag] : []),
    ];

    // Check if any location identifier appears in the environment tag or scene location
    return searchTerms.some(
      (term) =>
        envTagLower.includes(term) ||
        sceneLocLower.includes(term) ||
        // Reverse match: location name contains the search terms
        term.includes(envTagLower) ||
        term.includes(sceneLocLower)
    );
  });
}

export const analyzeScriptWorkflow = createScopedWorkflow<
  AnalyzeScriptWorkflowInput,
  Scene[]
>(
  async (context, scopedDb) => {
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
      autoGenerateMusic = false,
      musicModel,
      suggestedTalentIds,
      suggestedLocationIds,
    } = input;

    // Phase 1: Scene splitting
    if (!script) {
      throw new WorkflowValidationError('No script found');
    }

    const startTime = await context.run('start-time', () => Date.now());

    const llmCallContext = {
      sequenceId,
      userId: input.userId,
      scopedDb,
    };

    const { scenes, frameMapping } = await durableStreamingSceneSplit(
      context,
      {
        promptName: 'phase/scene-splitting-chat',
        promptVariables: {
          aspectRatio,
          script: sanitizeScriptContent(script),
        },
        modelId: analysisModelId,
        responseSchema: sceneSplittingResultSchema,
        sequenceId,
        autoGenerateMotion,
      },
      llmCallContext
    );
    const [characterMatchingResult, locationMatchingResult] = await Promise.all(
      [
        context.invoke('talent-matching', {
          workflow: talentMatchingWorkflow,
          body: {
            sequenceId,
            userId: input.userId,
            teamId: input.teamId,
            scenes,
            analysisModelId,
            suggestedTalentIds,
          },
        }),
        context.invoke('location-matching', {
          workflow: locationMatchingWorkflow,
          body: {
            sequenceId,
            userId: input.userId,
            teamId: input.teamId,
            scenes,
            analysisModelId,
            suggestedLocationIds,
          },
        }),
      ]
    );
    if (characterMatchingResult.isFailed || characterMatchingResult.isCanceled)
      throw new Error('Character sheet generation failed');
    if (locationMatchingResult.isFailed || locationMatchingResult.isCanceled)
      throw new Error('Location sheet generation failed');

    const { characterBible, matches: talentCharacterMatches } =
      characterMatchingResult.body;
    const { locationBible, matches: libraryLocationMatches } =
      locationMatchingResult.body;

    // Generate character sheets, location sheets, and visual prompts in parallel
    const [charResult, locationResult, visualResult] = await Promise.all([
      context.invoke('character-sheet-from-bible', {
        workflow: characterBibleWorkflow,
        body: {
          sequenceId,
          userId: input.userId,
          teamId: input.teamId,
          characterBible,
          talentMatches: talentCharacterMatches,
          imageModel,
        },
        flowControl: getFalFlowControl(),
      }),
      context.invoke('location-sheet-from-bible', {
        workflow: locationBibleWorkflow,
        body: {
          sequenceId,
          userId: input.userId,
          teamId: input.teamId,
          locationBible,
          libraryLocationMatches,
        },
        flowControl: getFalFlowControl(),
      }),
      context.invoke('visual-prompts', {
        workflow: visualPromptWorkflow,
        body: {
          userId: input.userId,
          teamId: input.teamId,
          sequenceId,
          scenes,
          aspectRatio,
          characterBible,
          locationBible,
          styleConfig,
          analysisModelId,
        },
      }),
    ]);

    if (charResult.isFailed || charResult.isCanceled)
      throw new Error('Character sheet generation failed');
    if (locationResult.isFailed || locationResult.isCanceled)
      throw new Error('Location sheet generation failed');
    if (visualResult.isFailed || visualResult.isCanceled)
      throw new Error('Visual prompt generation failed');

    const charactersWithSheets = charResult.body;
    const locationsWithSheets = locationResult.body;
    const scenesWithVisualPrompts = visualResult.body;

    // Persist visual prompts + continuity to frames immediately
    // so cast/location tabs work before image generation completes
    if (sequenceId) {
      await context.run('update-frames-after-visual-prompts', async () => {
        await Promise.all(
          scenesWithVisualPrompts.map(async (scene) => {
            const matched = frameMapping.find(
              (f) => f.sceneId === scene.sceneId
            );
            if (!matched) return;
            await scopedDb.frames.update(matched.frameId, {
              metadata: scene,
              imagePrompt: scene.prompts?.visual?.fullPrompt,
            });
            await getGenerationChannel(sequenceId).emit(
              'generation.frame:updated',
              {
                frameId: matched.frameId,
                updateType: 'visual-prompt',
                metadata: scene,
              }
            );
          })
        );
      });
    }

    let imageUrls: string[] = [];

    if (imageModel) {
      const imageSize = aspectRatioToImageSize(aspectRatio);

      // Build per-scene character and location maps for reference image lookup
      const sceneCharacterMap = Object.fromEntries(
        scenesWithVisualPrompts.map((scene) => [
          scene.sceneId,
          matchCharactersToScene(
            charactersWithSheets,
            scene.continuity?.characterTags || []
          ),
        ])
      );
      const sceneLocationMap = Object.fromEntries(
        scenesWithVisualPrompts.map((scene) => [
          scene.sceneId,
          matchLocationsToScene(
            locationsWithSheets,
            scene.continuity?.environmentTag || '',
            scene.metadata?.location || ''
          ),
        ])
      );

      await context.run('frame-images-start', async () => {
        if (sequenceId) {
          await scopedDb.sequences.updateAnalysisDurationMs(
            sequenceId,
            Date.now() - startTime
          );
        }
        await getGenerationChannel(sequenceId).emit('generation.phase:start', {
          phase: 4,
          phaseName: 'Generating images…',
        });
      });

      imageUrls = await Promise.all(
        scenesWithVisualPrompts.map(async (scene) => {
          const visualPrompt = scene.prompts?.visual?.fullPrompt;
          if (!visualPrompt) {
            throw new WorkflowValidationError(
              `Scene ${scene.sceneId} has no visual prompt`
            );
          }

          const matchedFrame = frameMapping.find(
            (f) => f.sceneId === scene.sceneId
          );

          const characterRefs = buildCharacterReferenceImages(
            sceneCharacterMap[scene.sceneId] || []
          );
          const locationRefs = buildLocationReferenceImages(
            sceneLocationMap[scene.sceneId] || []
          );
          const allReferences = [...characterRefs, ...locationRefs];

          const result = await context.invoke('image', {
            workflow: generateImageWorkflow,
            body: {
              userId: input.userId,
              teamId: input.teamId,
              prompt: visualPrompt,
              model: imageModel,
              imageSize,
              numImages: 1,
              frameId: matchedFrame?.frameId,
              sequenceId,
              referenceImages:
                allReferences.length > 0 ? allReferences : undefined,
            } satisfies ImageWorkflowInput,
            retries: 3,
            retryDelay: 'pow(2, retried) * 1000',
            flowControl: getFalFlowControl(),
          });

          if (result.isFailed || result.isCanceled || !result.body.imageUrl) {
            throw new WorkflowValidationError(
              `Image generation failed for scene ${scene.sceneId}`
            );
          }
          return result.body.imageUrl;
        })
      );
    }

    await context.run('frame-images-complete', async () => {
      await getGenerationChannel(sequenceId).emit('generation.phase:complete', {
        phase: 4,
      });
    });

    // Motion prompt generation — emit phase 5 start
    await context.run('motion-prompts-start', async () => {
      await getGenerationChannel(sequenceId).emit('generation.phase:start', {
        phase: 5,
        phaseName: 'Writing motion prompts…',
      });
    });
    const partialScenesWithMotionPrompts = await context.invoke(
      'motion-prompts',
      {
        workflow: motionPromptWorkflow,
        body: {
          userId: input.userId,
          teamId: input.teamId,
          sequenceId,
          scenes: scenesWithVisualPrompts,
          aspectRatio,
          characterBible,
          styleConfig,
          analysisModelId,
        },
      }
    );

    const scenesWithMotionPrompts: Scene[] = await context.run(
      'merge-motion-prompts',
      () => {
        const modelKey = videoModel || DEFAULT_VIDEO_MODEL;
        const modelConfig = IMAGE_TO_VIDEO_MODELS[modelKey];

        return scenesWithVisualPrompts.map((scene) => {
          const enrichment = partialScenesWithMotionPrompts.body.find(
            (s) => s.sceneId === scene.sceneId
          );
          if (!enrichment) {
            throw new WorkflowValidationError(
              `Scene ID mismatch in motion prompts: expected "${scene.sceneId}"`
            );
          }

          // Snap duration to model capabilities so music generation uses accurate values
          const metadata =
            scene.metadata && modelConfig
              ? {
                  ...scene.metadata,
                  durationSeconds: snapDuration(
                    scene.metadata.durationSeconds,
                    modelConfig.capabilities
                  ),
                }
              : scene.metadata;

          return {
            ...scene,
            metadata,
            prompts: {
              ...scene.prompts,
              motion: enrichment.prompts?.motion,
            },
          };
        });
      }
    );

    // Emit phase 5 complete after motion prompts are merged
    await context.run('motion-prompts-complete', async () => {
      await getGenerationChannel(sequenceId).emit('generation.phase:complete', {
        phase: 5,
      });
    });

    if (sequenceId) {
      await context.run('update-frames-after-motion-prompts', async () => {
        await Promise.all(
          scenesWithMotionPrompts.map(async (scene) => {
            const matched = frameMapping.find(
              (f) => f.sceneId === scene.sceneId
            );
            if (!matched) return;
            await scopedDb.frames.update(matched.frameId, {
              metadata: scene,
              motionPrompt: scene.prompts?.motion?.fullPrompt,
              durationMs: Math.round(
                (scene.metadata?.durationSeconds || 3) * 1000
              ),
            });
            await getGenerationChannel(sequenceId).emit(
              'generation.frame:updated',
              {
                frameId: matched.frameId,
                updateType: 'motion-prompt',
                metadata: scene,
              }
            );
          })
        );
      });
    }

    // Music design: classify each scene + generate unified tags/prompt
    const sceneSummaries = scenesWithMotionPrompts.map((scene) => ({
      sceneId: scene.sceneId,
      title: scene.metadata?.title || 'Untitled Scene',
      storyBeat: scene.metadata?.storyBeat || '',
      durationSeconds: scene.metadata?.durationSeconds || 5,
      location: scene.metadata?.location || '',
      timeOfDay: scene.metadata?.timeOfDay || '',
      visualSummary: scene.prompts?.visual?.components?.atmosphere || '',
    }));

    const musicDesignResult = await durableLLMCall(
      context,
      {
        name: 'music-design',
        phase: { number: 6, name: 'Composing music…' },
        promptName: 'phase/music-design-chat',
        promptVariables: {
          scenes: JSON.stringify(sceneSummaries, null, 2),
        },
        modelId: analysisModelId,
        responseSchema: musicDesignResultSchema,
      },
      llmCallContext
    );

    const completeScenes: Scene[] = await context.run(
      'merge-music-design',
      () =>
        scenesWithMotionPrompts.map((scene) => {
          const enrichment = musicDesignResult.scenes.find(
            (s) => s.sceneId === scene.sceneId
          );
          if (!enrichment) {
            throw new WorkflowValidationError(
              `Scene ID mismatch in music design: expected "${scene.sceneId}"`
            );
          }
          return {
            ...scene,
            musicDesign: enrichment.musicDesign,
          };
        })
    );

    if (sequenceId) {
      await context.run('update-frames-after-music-design', async () => {
        await Promise.all(
          completeScenes.map(async (scene) => {
            const matched = frameMapping.find(
              (f) => f.sceneId === scene.sceneId
            );
            if (!matched) return;
            await scopedDb.frames.update(matched.frameId, { metadata: scene });
            await getGenerationChannel(sequenceId).emit(
              'generation.frame:updated',
              {
                frameId: matched.frameId,
                updateType: 'music-design',
                metadata: scene,
              }
            );
          })
        );
      });
    }

    // Store music prompt + generate motion/music if scenes have music
    const scenesWithMusic = completeScenes.filter(
      (scene) =>
        scene.musicDesign?.presence && scene.musicDesign.presence !== 'none'
    );

    const reinforcedTags = reinforceInstrumentalTags(musicDesignResult.tags);

    if (sequenceId) {
      await context.run('store-music-prompt', async () => {
        await scopedDb.sequences.updateMusicPrompt(
          sequenceId,
          musicDesignResult.prompt,
          reinforcedTags
        );
      });
    }

    if (scenesWithMusic.length > 0) {
      let totalDuration = 0;
      for (const scene of scenesWithMusic) {
        totalDuration += scene.metadata?.durationSeconds || 5;
      }

      // Generate motion for each scene
      if (autoGenerateMotion && videoModel && imageUrls.length > 0) {
        await context.run('start-motion-generation', async () => {
          await getGenerationChannel(sequenceId).emit(
            'generation.phase:start',
            {
              phase: 7,
              phaseName: 'Generating motion…',
            }
          );
        });

        await Promise.all(
          completeScenes.map(async (scene, index) => {
            const motionPrompt = scene.prompts?.motion?.fullPrompt;
            if (!motionPrompt) {
              throw new WorkflowValidationError(
                `Scene ${scene.sceneId} has no motion prompt`
              );
            }

            const matchedFrame = frameMapping.find(
              (f) => f.sceneId === scene.sceneId
            );

            await context.invoke('motion', {
              workflow: generateMotionWorkflow,
              body: {
                userId: input.userId,
                teamId: input.teamId,
                frameId: matchedFrame?.frameId,
                sequenceId,
                imageUrl: imageUrls[index],
                prompt: motionPrompt,
                model: videoModel,
                aspectRatio,
                duration: scene.metadata?.durationSeconds || 3,
              } satisfies MotionWorkflowInput,
              retries: 3,
              retryDelay: 'pow(2, retried) * 1000',
              flowControl: getFalFlowControl(),
            });
          })
        );
      }

      // Generate music for whole movie
      if (autoGenerateMusic && sequenceId) {
        if (!input.userId || !input.teamId) {
          throw new Error('userId and teamId required for music generation');
        }

        await context.invoke('music', {
          workflow: generateMusicWorkflow,
          body: {
            userId: input.userId,
            teamId: input.teamId,
            sequenceId,
            prompt: musicDesignResult.prompt,
            tags: reinforcedTags,
            duration: totalDuration,
            model: musicModel,
          } satisfies MusicWorkflowInput,
          retries: 3,
          retryDelay: 'pow(2, retried) * 1000',
          flowControl: getFalFlowControl(),
        });
      }
    }

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
    failureFunction: async ({ context, scopedDb, failResponse }) => {
      const { sequenceId } = context.requestPayload;
      if (!sequenceId) return;

      const error = sanitizeFailResponse(failResponse);
      console.error('[AnalyzeScriptWorkflow] Failure:', error);
      await scopedDb.sequence(sequenceId).updateStatus('failed', error);
      await getGenerationChannel(sequenceId).emit('generation.failed', {
        message: error,
      });

      return `Analysis workflow failed: ${error}`;
    },
  }
);
