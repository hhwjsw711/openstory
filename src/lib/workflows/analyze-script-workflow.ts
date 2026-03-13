/**
 * Frame generation workflow
 * Orchestrates script analysis, frame creation, and thumbnail generation
 */

import { buildLocationMatchingPromptVariables } from '@/lib/ai/location-matching-prompt';
import { sanitizeScriptContent } from '@/lib/ai/prompt-validation';
import {
  characterExtractionResultSchema,
  locationExtractionResultSchema,
  locationMatchResponseSchema,
  musicDesignResultSchema,
  sceneSplittingResultSchema,
  talentMatchResponseSchema,
} from '@/lib/ai/response-schemas';
import type { Scene } from '@/lib/ai/scene-analysis.schema';
import { buildMatchingPromptVariables } from '@/lib/ai/talent-matching-prompt';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import { updateFrame } from '@/lib/db/helpers/frames';
import { getLibraryLocationsByIds } from '@/lib/db/helpers/location-library';
import {
  updateSequenceAnalysisDurationMs,
  updateSequenceMusicPrompt,
  updateSequenceStatus,
} from '@/lib/db/helpers/sequences';
import { getTalentByIds } from '@/lib/db/helpers/talent';
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
  LibraryLocationMatch,
  MotionWorkflowInput,
  MusicWorkflowInput,
  TalentCharacterMatch,
} from '@/lib/workflow/types';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

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
      teamId: input.teamId,
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

    // Phase 2: Character and location extraction
    const { characterBible } = await durableLLMCall(
      context,
      {
        name: 'character-extraction',
        phase: { number: 2, name: 'Finding characters…' },

        promptName: 'phase/character-extraction-chat',
        promptVariables: {
          scenes: JSON.stringify(scenes, null, 2),
        },

        modelId: analysisModelId,
        responseSchema: characterExtractionResultSchema,
      },
      llmCallContext
    );

    const { locationBible } = await durableLLMCall(
      context,
      {
        name: 'location-extraction',
        phase: { number: 2, name: 'Finding locations…' },

        promptName: 'phase/location-extraction-chat',
        promptVariables: {
          scenes: JSON.stringify(scenes, null, 2),
        },

        modelId: analysisModelId,
        responseSchema: locationExtractionResultSchema,
      },
      llmCallContext
    );

    // Talent matching (conditional)
    const { talentList, matchingPromptVariables } = await context.run(
      'get-talent-list',
      async () => {
        if (!suggestedTalentIds?.length || !input.teamId) {
          return { talentList: [], matchingPromptVariables: {} };
        }
        const talentList = await getTalentByIds(
          suggestedTalentIds,
          input.teamId
        );
        return {
          talentList,
          matchingPromptVariables: buildMatchingPromptVariables(
            characterBible,
            talentList
          ),
        };
      }
    );

    const { matches: talentMatches } =
      talentList.length > 0
        ? await durableLLMCall(
            context,
            {
              name: 'talent-matching',
              phase: { number: 3, name: 'Casting characters…' },

              promptName: 'phase/talent-matching-chat',
              promptVariables: matchingPromptVariables,
              modelId: analysisModelId,
              responseSchema: talentMatchResponseSchema,
            },
            llmCallContext
          )
        : { matches: [] };

    const talentCharacterMatches: TalentCharacterMatch[] = await context.run(
      'build-matches',
      async () => {
        const usedTalentIds = new Set<string>();
        const usedCharacterIds = new Set<string>();
        const matches: TalentCharacterMatch[] = [];

        for (const match of talentMatches) {
          // Ensure each talent and character is only cast once
          if (usedTalentIds.has(match.talentId)) continue;
          if (usedCharacterIds.has(match.characterId)) continue;

          const talent = talentList.find((t) => t.id === match.talentId);
          if (!talent?.imageUrl) continue;

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

    // Location matching (conditional)
    const { libraryLocationList, locationMatchingPromptVariables } =
      await context.run('get-library-locations', async () => {
        if (!suggestedLocationIds?.length || !input.teamId) {
          return {
            libraryLocationList: [],
            locationMatchingPromptVariables: {},
          };
        }
        const libraryLocationList =
          await getLibraryLocationsByIds(suggestedLocationIds);
        return {
          libraryLocationList,
          locationMatchingPromptVariables: buildLocationMatchingPromptVariables(
            locationBible,
            libraryLocationList
          ),
        };
      });

    const { matches: locationMatches } =
      libraryLocationList.length > 0
        ? await durableLLMCall(
            context,
            {
              name: 'location-matching',
              phase: { number: 3, name: 'Matching locations…' },

              promptName: 'phase/location-matching-chat',
              promptVariables: locationMatchingPromptVariables,
              modelId: analysisModelId,
              responseSchema: locationMatchResponseSchema,
            },
            llmCallContext
          )
        : { matches: [] };

    const libraryLocationMatches: LibraryLocationMatch[] = await context.run(
      'build-location-matches',
      async () => {
        const usedLibraryIds = new Set<string>();
        const usedLocationIds = new Set<string>();
        const matches: LibraryLocationMatch[] = [];

        for (const match of locationMatches) {
          if (usedLibraryIds.has(match.libraryLocationId)) continue;
          if (usedLocationIds.has(match.locationId)) continue;
          if (match.confidence < 0.5) continue;

          const libraryLoc = libraryLocationList.find(
            (lib) => lib.id === match.libraryLocationId
          );
          if (!libraryLoc?.referenceImageUrl) continue;

          const location = locationBible.find(
            (loc) => loc.locationId === match.locationId
          );
          if (!location) continue;

          usedLibraryIds.add(match.libraryLocationId);
          usedLocationIds.add(match.locationId);
          matches.push({
            locationId: match.locationId,
            libraryLocationId: match.libraryLocationId,
            libraryLocationName: libraryLoc.name,
            referenceImageUrl: libraryLoc.referenceImageUrl,
            description: libraryLoc.description ?? undefined,
          });
        }

        if (matches.length > 0) {
          await getGenerationChannel(sequenceId).emit(
            'generation.location:matched',
            {
              matches: matches.map((m) => {
                const loc = locationBible.find(
                  (l) => l.locationId === m.locationId
                );
                return {
                  locationId: m.locationId,
                  locationName: loc?.name ?? m.locationId,
                  libraryLocationId: m.libraryLocationId,
                  libraryLocationName: m.libraryLocationName,
                  referenceImageUrl: m.referenceImageUrl,
                  description: m.description ?? undefined,
                };
              }),
            }
          );
        }

        return matches;
      }
    );

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
            await updateFrame(matched.frameId, {
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
          await updateSequenceAnalysisDurationMs(
            sequenceId,
            Date.now() - startTime
          );
        }
        await getGenerationChannel(sequenceId).emit('generation.phase:start', {
          phase: 5,
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
        phase: 5,
      });
    });

    // Motion prompt generation
    const partialScenesWithMotionPrompts = await context.invoke(
      'motion-prompts',
      {
        workflow: motionPromptWorkflow,
        body: {
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

    if (sequenceId) {
      await context.run('update-frames-after-motion-prompts', async () => {
        await Promise.all(
          scenesWithMotionPrompts.map(async (scene) => {
            const matched = frameMapping.find(
              (f) => f.sceneId === scene.sceneId
            );
            if (!matched) return;
            await updateFrame(matched.frameId, {
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
      durationSeconds: scene.metadata?.durationSeconds || 10,
      location: scene.metadata?.location || '',
      timeOfDay: scene.metadata?.timeOfDay || '',
      visualSummary: scene.prompts?.visual?.components?.atmosphere || '',
    }));

    const musicDesignResult = await durableLLMCall(
      context,
      {
        name: 'music-design',
        phase: { number: 7, name: 'Composing music…' },
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
            await updateFrame(matched.frameId, { metadata: scene });
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
        await updateSequenceMusicPrompt(
          sequenceId,
          musicDesignResult.prompt,
          reinforcedTags
        );
      });
    }

    if (scenesWithMusic.length > 0) {
      let totalDuration = 0;
      for (const scene of scenesWithMusic) {
        totalDuration += scene.metadata?.durationSeconds || 10;
      }

      // Generate motion for each scene
      if (autoGenerateMotion && videoModel && imageUrls.length > 0) {
        await context.run('start-motion-generation', async () => {
          await getGenerationChannel(sequenceId).emit(
            'generation.phase:start',
            {
              phase: 8,
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
    failureFunction: async ({ context, failResponse }) => {
      const { sequenceId } = context.requestPayload;
      if (!sequenceId) return;

      const error = sanitizeFailResponse(failResponse);
      console.error('[AnalyzeScriptWorkflow] Failure:', error);
      await updateSequenceStatus(sequenceId, 'failed', error);
      await getGenerationChannel(sequenceId).emit('generation.failed', {
        message: error,
      });

      return `Analysis workflow failed: ${error}`;
    },
  }
);
