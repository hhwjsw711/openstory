import { getDb } from '#db-client';
import { DEFAULT_MUSIC_MODEL } from '@/lib/ai/models';
import { DEFAULT_ANALYSIS_MODEL } from '@/lib/ai/models.config';
import { uploadAudioToStorage } from '@/lib/audio/audio-storage';
import { generateMusicForScene } from '@/lib/audio/music-generation';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import { sequences } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';
import { triggerWorkflow } from '@/lib/workflow/client';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import type {
  MergeAudioVideoWorkflowInput,
  MusicWorkflowInput,
} from '@/lib/workflow/types';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { durableLLMCall } from './llm-call-helper';
import {
  musicPromptSchema,
  reinforceInstrumentalTags,
} from './music-prompt.schema';

import { eq } from 'drizzle-orm';

export const generateMusicWorkflow = createWorkflow(
  async (context: WorkflowContext<MusicWorkflowInput>) => {
    const input = context.requestPayload;

    if (!input.prompt && !input.tags && !input.scenes?.length) {
      throw new WorkflowValidationError(
        'Either prompt+tags or scenes are required for music generation'
      );
    }

    const { sequenceId, teamId } = input;
    const model = input.model || DEFAULT_MUSIC_MODEL;

    await context.run('set-generating-status', async () => {
      await getDb()
        .update(sequences)
        .set({
          musicStatus: 'generating',
          musicModel: model,
          musicError: null,
          updatedAt: new Date(),
        })
        .where(eq(sequences.id, sequenceId));

      await getGenerationChannel(sequenceId).emit('generation.audio:progress', {
        status: 'generating',
      });
    });

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
          teamId,
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
        teamId,
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
    const musicCost =
      typeof audioResult.metadata?.cost === 'number'
        ? audioResult.metadata.cost
        : 0;
    if (musicCost > 0 && !audioResult.metadata.usedOwnKey) {
      await context.run('deduct-credits', async () => {
        const canAfford = await hasEnoughCredits(teamId, musicCost);
        if (!canAfford) {
          console.warn(
            `[MusicWorkflow] Insufficient credits for team ${teamId} (cost: $${musicCost.toFixed(4)}), skipping deduction`
          );
          return;
        }
        await deductCredits(teamId, musicCost, {
          userId: input.userId,
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
    const audioUrl = audioResult.audioUrl;

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

    await context.run('update-sequence-music', async () => {
      await getDb()
        .update(sequences)
        .set({
          musicUrl: storageResult.url,
          musicPath: storageResult.path,
          musicStatus: 'completed',
          musicGeneratedAt: new Date(),
          musicError: null,
          updatedAt: new Date(),
        })
        .where(eq(sequences.id, sequenceId));

      await getGenerationChannel(sequenceId).emit('generation.audio:progress', {
        status: 'completed',
        audioUrl: storageResult.url,
      });
    });

    // Check if merged video is also ready -- trigger mux if so
    await context.run('check-mux-trigger', async () => {
      const [seq] = await getDb()
        .select({
          mergedVideoStatus: sequences.mergedVideoStatus,
          mergedVideoUrl: sequences.mergedVideoUrl,
        })
        .from(sequences)
        .where(eq(sequences.id, sequenceId));

      if (seq?.mergedVideoStatus === 'completed' && seq.mergedVideoUrl) {
        console.log(
          `[MusicWorkflow] Music + merged video both ready, triggering mux for sequence ${sequenceId}`
        );

        const muxInput: MergeAudioVideoWorkflowInput = {
          userId: input.userId,
          teamId,
          sequenceId,
          mergedVideoUrl: seq.mergedVideoUrl,
          musicUrl: storageResult.url,
        };

        await triggerWorkflow('/merge-audio-video', muxInput);
      }
    });

    console.log('[MusicWorkflow]', 'Music generation workflow completed');
    return { audioUrl: storageResult.url, duration: actualDuration };
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      await getDb()
        .update(sequences)
        .set({
          musicStatus: 'failed',
          musicError: String(failResponse),
          updatedAt: new Date(),
        })
        .where(eq(sequences.id, input.sequenceId));

      try {
        await getGenerationChannel(input.sequenceId).emit(
          'generation.audio:progress',
          { status: 'failed' }
        );
      } catch {
        // Ignore emit errors
      }

      console.error(
        '[MusicWorkflow]',
        `Music generation failed for sequence ${input.sequenceId}: ${failResponse}`
      );
      return `Music generation failed for sequence ${input.sequenceId}`;
    },
  }
);
