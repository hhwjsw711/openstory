/**
 * Frame generation workflow
 * Orchestrates script analysis, frame creation, and thumbnail generation
 */

import { sanitizeScriptContent } from '@/lib/ai/prompt-validation';
import { sceneSplittingResultSchema } from '@/lib/ai/response-schemas';
import type { Scene } from '@/lib/ai/scene-analysis.schema';
import { recordWorkflowTrace } from '@/lib/observability/langfuse';
import { getGenerationChannel } from '@/lib/realtime';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { sanitizeFailResponse } from '@/lib/workflow/sanitize-fail-response';
import type {
  AnalyzeScriptWorkflowInput,
  FrameImagesWorkflowInput,
  MotionMusicPromptsWorkflowInput,
  MotionWorkflowInput,
  MusicWorkflowInput,
} from '@/lib/workflow/types';

import { assembleMotionPrompt } from '@/lib/motion/assemble-motion-prompt';
import { generateMotionWorkflow } from '@/lib/workflows/motion-workflow';
import { generateMusicWorkflow } from '@/lib/workflows/music-workflow';
import { characterBibleWorkflow } from './character-bible-workflow';
import { getFalFlowControl } from './constants';
import { frameImagesWorkflow } from './frame-images-workflow';
import { durableStreamingSceneSplit } from './llm-call-helper';
import { locationBibleWorkflow } from './location-bible-workflow';
import { motionMusicPromptsWorkflow } from './motion-music-prompts-workflow';

import { createScopedWorkflow } from '../workflow/scoped-workflow';
import { locationMatchingWorkflow } from './location-matching-workflow';
import { talentMatchingWorkflow } from './talent-matching-workflow';
import { visualPromptWorkflow } from './visual-prompt-workflow';

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
    // Record start time of analysis
    const startTime = await context.run('start-time', () => Date.now());

    const llmCallContext = {
      sequenceId,
      userId: input.userId,
      scopedDb,
    };

    // @TODO: TB Mar 26 2026: Look at making this into a separate workflow
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

    // Phase 2: Talent + location matching in parallel
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

    // Phase 3: Character sheets, location sheets, and visual prompts in parallel
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
          frameMapping,
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

    // Phase 4+5+6: Frame images + variants AND motion + music prompts in parallel
    const [frameImagesResult, motionMusicResult] = await Promise.all([
      context.invoke('frame-images', {
        workflow: frameImagesWorkflow,
        body: {
          userId: input.userId,
          teamId: input.teamId,
          sequenceId,
          scenesWithVisualPrompts,
          charactersWithSheets,
          locationsWithSheets,
          frameMapping,
          imageModel,
          aspectRatio,
        } satisfies FrameImagesWorkflowInput,
      }),
      context.invoke('motion-music-prompts', {
        workflow: motionMusicPromptsWorkflow,
        body: {
          userId: input.userId,
          teamId: input.teamId,
          sequenceId,
          scenesWithVisualPrompts,
          frameMapping,
          aspectRatio,
          characterBible,
          locationBible,
          styleConfig,
          analysisModelId,
          videoModel,
        } satisfies MotionMusicPromptsWorkflowInput,
      }),
    ]);

    // Record analysis duration before generating motion
    await context.run('record-analysis-duration', async () => {
      if (sequenceId) {
        await scopedDb.sequences.updateAnalysisDurationMs(
          sequenceId,
          Date.now() - startTime
        );
      }
    });

    if (frameImagesResult.isFailed || frameImagesResult.isCanceled)
      throw new Error('Frame image generation failed');
    if (motionMusicResult.isFailed || motionMusicResult.isCanceled)
      throw new Error('Motion/music prompt generation failed');

    const imageUrls = frameImagesResult.body.imageUrls;
    const { completeScenes, musicPrompt, musicTags } = motionMusicResult.body;

    // Auto-generate motion + music if enabled
    const scenesWithMusic = completeScenes.filter(
      (scene) =>
        scene.musicDesign?.presence && scene.musicDesign.presence !== 'none'
    );

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
              phaseName: 'Generating motion\u2026',
            }
          );
        });

        await Promise.all(
          completeScenes.map(async (scene, index) => {
            const motionPromptData = scene.prompts?.motion;
            if (!motionPromptData?.fullPrompt) {
              throw new WorkflowValidationError(
                `Scene ${scene.sceneId} has no motion prompt`
              );
            }

            const matchedFrame = frameMapping.find(
              (f) => f.sceneId === scene.sceneId
            );

            const prompt = assembleMotionPrompt({
              motionPrompt: motionPromptData,
              model: videoModel,
            });

            await context.invoke('motion', {
              workflow: generateMotionWorkflow,
              body: {
                userId: input.userId,
                teamId: input.teamId,
                frameId: matchedFrame?.frameId,
                sequenceId,
                imageUrl: imageUrls[index],
                prompt,
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
            prompt: musicPrompt,
            tags: musicTags,
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
