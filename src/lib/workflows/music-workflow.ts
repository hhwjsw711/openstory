import { DEFAULT_MUSIC_MODEL } from '@/lib/ai/models';
import { DEFAULT_ANALYSIS_MODEL } from '@/lib/ai/models.config';
import { uploadAudioToStorage } from '@/lib/audio/audio-storage';
import { generateMusicForScene } from '@/lib/audio/music-generation';
import { ZERO_MICROS, microsToUsd } from '@/lib/billing/money';
import { getGenerationChannel } from '@/lib/realtime';
import { triggerWorkflow } from '@/lib/workflow/client';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { sanitizeFailResponse } from '@/lib/workflow/sanitize-fail-response';
import { createScopedWorkflow } from '@/lib/workflow/scoped-workflow';
import type {
  MergeAudioVideoWorkflowInput,
  MusicWorkflowInput,
} from '@/lib/workflow/types';
import { durableLLMCall } from './llm-call-helper';
import {
  musicPromptSchema,
  reinforceInstrumentalTags,
} from './music-prompt.schema';

export const generateMusicWorkflow = createScopedWorkflow<MusicWorkflowInput>(
  async (context, scopedDb) => {
    const input = context.requestPayload;

    if (!input.prompt && !input.tags && !input.scenes?.length) {
      throw new WorkflowValidationError(
        'Either prompt+tags or scenes are required for music generation'
      );
    }

    const { sequenceId, teamId } = input;
    const model = input.model || DEFAULT_MUSIC_MODEL;

    if (scopedDb && sequenceId) {
      await context.run('set-generating-status', async () => {
        await scopedDb.sequence(sequenceId).updateMusicFields({
          musicStatus: 'generating',
          musicModel: model,
          musicError: null,
        });

        await getGenerationChannel(sequenceId).emit(
          'generation.audio:progress',
          {
            status: 'generating',
          }
        );
      });
    }

    // Use pre-generated prompt or generate from scenes via LLM
    let effectivePrompt: string;
    let effectiveTags: string;

    if (input.prompt && input.tags) {
      effectivePrompt = input.prompt;
      effectiveTags = reinforceInstrumentalTags(input.tags);
    } else {
      const musicPrompt = await durableLLMCall(
        context,
        {
          name: 'music-prompt-generation',
          phase: { number: 8, name: 'Composing music…' },
          promptName: 'phase/music-prompt-generation-chat',
          promptVariables: {
            scenes: JSON.stringify(input.scenes),
          },
          modelId: DEFAULT_ANALYSIS_MODEL,
          responseSchema: musicPromptSchema,
        },
        {
          sequenceId,
          userId: input.userId,
          scopedDb,
        }
      );
      effectivePrompt = musicPrompt.prompt;
      // Reinforce instrumental -- ACE-Step sometimes generates vocals despite [inst]
      effectiveTags = reinforceInstrumentalTags(musicPrompt.tags);
    }

    const audioResult = await context.run('generate-music', async () => {
      const result = await generateMusicForScene({
        prompt: effectivePrompt,
        tags: effectiveTags,
        duration: input.duration,
        instrumental: true,
        model,
        traceName: 'sequence-music',
        scopedDb,
      });

      if (!result.success || !result.audioUrl) {
        throw new Error(result.error || 'Music generation failed');
      }

      return result;
    });

    const actualDuration =
      typeof audioResult.metadata?.duration === 'number'
        ? audioResult.metadata.duration
        : (input.duration ?? 60);

    // Deduct credits (skip if team used own fal key)
    const musicCostMicros = audioResult.metadata?.cost ?? ZERO_MICROS;
    if (musicCostMicros > 0 && !audioResult.metadata.usedOwnKey) {
      await context.run('deduct-credits', async () => {
        const canAfford =
          await scopedDb.billing.hasEnoughCredits(musicCostMicros);
        if (!canAfford) {
          console.warn(
            `[MusicWorkflow] Insufficient credits for team ${teamId} (cost: $${microsToUsd(musicCostMicros).toFixed(4)}), skipping deduction`
          );
          return;
        }
        await scopedDb.billing.deductCredits(musicCostMicros, {
          description: `Music generation (${model})`,
          metadata: {
            model,
            sequenceId,
            duration: audioResult.metadata?.duration,
          },
        });
      });
    }

    if (!audioResult.audioUrl) {
      throw new Error('Audio URL missing from generation result');
    }
    let audioUrl = audioResult.audioUrl;
    if (sequenceId && scopedDb) {
      const storageResult = await context.run('upload-to-storage', async () => {
        const result = await uploadAudioToStorage({
          audioUrl,
          teamId,
          sequenceId,
          sequenceTitle: 'sequence',
          sceneTitle: 'music',
        });

        if (!result.success || !result.path) {
          throw new Error('Failed to upload audio');
        }

        return { path: result.path, url: result.url };
      });
      if (storageResult.url) {
        audioUrl = storageResult.url;
      }
      await context.run('update-sequence-music', async () => {
        await scopedDb.sequence(sequenceId).updateMusicFields({
          musicUrl: audioUrl,
          musicPath: storageResult.path,
          musicStatus: 'completed',
          musicGeneratedAt: new Date(),
          musicError: null,
        });

        await getGenerationChannel(sequenceId).emit(
          'generation.audio:progress',
          {
            status: 'completed',
            audioUrl: audioUrl,
          }
        );
      });

      // Check if merged video is also ready -- trigger mux if so
      await context.run('check-mux-trigger', async () => {
        const videoStatus = await scopedDb
          .sequence(sequenceId)
          .getMergedVideoStatus();

        if (
          videoStatus?.mergedVideoStatus === 'completed' &&
          videoStatus.mergedVideoUrl
        ) {
          console.log(
            `[MusicWorkflow] Music + merged video both ready, triggering mux for sequence ${sequenceId}`
          );

          const muxInput: MergeAudioVideoWorkflowInput = {
            userId: input.userId,
            teamId,
            sequenceId,
            mergedVideoUrl: videoStatus.mergedVideoUrl,
            musicUrl: audioUrl,
          };

          await triggerWorkflow('/merge-audio-video', muxInput);
        }
      });
    }

    console.log('[MusicWorkflow]', 'Music generation workflow completed');
    return { audioUrl: audioUrl, duration: actualDuration };
  },
  {
    failureFunction: async ({ context, scopedDb, failResponse }) => {
      const input = context.requestPayload;
      const error = sanitizeFailResponse(failResponse);
      if (input.sequenceId) {
        const failSeq = scopedDb.sequence(input.sequenceId);

        await failSeq.updateMusicFields({
          musicStatus: 'failed',
          musicError: error,
        });

        try {
          await getGenerationChannel(input.sequenceId).emit(
            'generation.audio:progress',
            { status: 'failed' }
          );
        } catch {
          // Ignore emit errors
        }
      }
      console.error(
        '[MusicWorkflow]',
        `Music generation failed for sequence ${input.sequenceId}: ${error}`
      );
      return `Music generation failed for sequence ${input.sequenceId}`;
    },
  }
);
