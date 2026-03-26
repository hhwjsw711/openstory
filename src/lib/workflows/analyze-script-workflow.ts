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
  BatchMotionMusicWorkflowInput,
  FrameImagesWorkflowInput,
  MotionMusicPromptsWorkflowInput,
} from '@/lib/workflow/types';

import { assembleMotionPrompt } from '@/lib/motion/assemble-motion-prompt';
import { motionBatchWorkflow } from '@/lib/workflows/motion-batch-workflow';
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

    // Phase 1 START
    await context.run('phase-1-start', async () => {
      await getGenerationChannel(sequenceId).emit('generation.phase:start', {
        phase: 1,
        phaseName: 'Analyzing script\u2026',
      });
    });

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

    // Phase 2 START
    await context.run('phase-2-start', async () => {
      await getGenerationChannel(sequenceId).emit('generation.phase:start', {
        phase: 2,
        phaseName: 'Casting characters & locations\u2026',
      });
    });

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

    // Phase 3 START
    await context.run('phase-3-start', async () => {
      await getGenerationChannel(sequenceId).emit('generation.phase:start', {
        phase: 3,
        phaseName: 'Generating references & prompts\u2026',
      });
    });

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

    // Phase 4 START
    await context.run('phase-4-start', async () => {
      await getGenerationChannel(sequenceId).emit('generation.phase:start', {
        phase: 4,
        phaseName: 'Generating images\u2026',
      });
    });

    // Phase 4: Frame images + variants AND motion + music prompts in parallel
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
    const shouldGenerateMotion =
      autoGenerateMotion && videoModel && imageUrls.length > 0;
    const shouldGenerateMusic = Boolean(
      autoGenerateMusic &&
      sequenceId &&
      completeScenes.some(
        (s) => s.musicDesign?.presence && s.musicDesign.presence !== 'none'
      )
    );

    if (shouldGenerateMotion) {
      let totalDuration = 0;
      for (const scene of completeScenes) {
        totalDuration += scene.metadata?.durationSeconds || 5;
      }

      const batchFrames = completeScenes.map((scene, index) => {
        const motionPromptData = scene.prompts?.motion;
        if (!motionPromptData?.fullPrompt) {
          throw new WorkflowValidationError(
            `Scene ${scene.sceneId} has no motion prompt`
          );
        }

        const matchedFrame = frameMapping.find(
          (f) => f.sceneId === scene.sceneId
        );

        return {
          frameId: matchedFrame?.frameId ?? '',
          imageUrl: imageUrls[index],
          prompt: assembleMotionPrompt({
            motionPrompt: motionPromptData,
            model: videoModel,
          }),
          model: videoModel,
          duration: scene.metadata?.durationSeconds || 3,
          aspectRatio,
        };
      });

      // Phase 5: single orchestrator for motion + optional music + merge
      await context.invoke('motion-batch', {
        workflow: motionBatchWorkflow,
        body: {
          userId: input.userId,
          teamId: input.teamId,
          sequenceId,
          includeMusic: shouldGenerateMusic,
          frames: batchFrames,
          music: shouldGenerateMusic
            ? {
                prompt: musicPrompt,
                tags: musicTags,
                duration: totalDuration,
                model: musicModel,
              }
            : undefined,
        } satisfies BatchMotionMusicWorkflowInput,
      });
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
