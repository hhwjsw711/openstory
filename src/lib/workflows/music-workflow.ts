/**
 * Music generation workflow
 * Generates background music/audio for entire sequences
 * Uses AI to synthesize scene data into cohesive music prompts
 */

import { getDb } from '#db-client';
import { DEFAULT_ANALYSIS_MODEL } from '@/lib/ai/models.config';
import { sequences } from '@/lib/db/schema';
import type {
  MergeAudioVideoWorkflowInput,
  MusicWorkflowInput,
} from '@/lib/workflow/types';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import { getGenerationChannel } from '@/lib/realtime';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { generateMusicForScene } from '@/lib/audio/music-generation';
import { uploadAudioToStorage } from '@/lib/audio/audio-storage';
import { DEFAULT_MUSIC_MODEL } from '@/lib/ai/models';
import { resolveWorkflowApiKeys } from '@/lib/workflow/resolve-keys';
import { triggerWorkflow } from '@/lib/workflow/client';
import { durableLLMCall } from './llm-call-helper';
import { musicPromptSchema } from './music-prompt.schema';
import { getFalFlowControl } from './constants';
import { eq } from 'drizzle-orm';

export const generateMusicWorkflow = createWorkflow(
  async (context: WorkflowContext<MusicWorkflowInput>) => {
    const input = context.requestPayload;

    if (!input.scenes || input.scenes.length === 0) {
      throw new WorkflowValidationError(
        'At least one scene is required for music generation'
      );
    }

    const { sequenceId } = input;

    // Step 1: Set status to generating
    await context.run('set-generating-status', async () => {
      await getDb()
        .update(sequences)
        .set({
          musicStatus: 'generating',
          musicModel: input.model || DEFAULT_MUSIC_MODEL,
          musicError: null,
          updatedAt: new Date(),
        })
        .where(eq(sequences.id, sequenceId));

      await getGenerationChannel(sequenceId).emit('generation.audio:progress', {
        status: 'generating',
      });
    });

    // Resolve team API keys
    const apiKeys = await context.run('resolve-api-keys', async () => {
      return resolveWorkflowApiKeys(input.teamId);
    });

    // Step 2: AI-generate a cohesive music prompt from scene data
    const musicPrompt = await durableLLMCall(
      context,
      {
        name: 'music-prompt-generation',
        phase: { number: 8, name: 'Music Prompt Generation' },
        promptName: 'velro/phase/music-prompt-generation-chat',
        promptVariables: {
          scenes: JSON.stringify(input.scenes),
        },
        modelId: DEFAULT_ANALYSIS_MODEL,
        responseSchema: musicPromptSchema,
      },
      {
        sequenceId,
        userId: input.userId,
        teamId: input.teamId,
        openRouterApiKey: apiKeys.openRouterApiKey,
      }
    );

    // Reinforce instrumental — ACE-Step sometimes generates vocals despite [inst]
    const reinforcedTags = musicPrompt.tags.includes('instrumental')
      ? musicPrompt.tags
      : `${musicPrompt.tags}, instrumental, no vocals`;

    // Step 3: Generate music using AI-synthesized prompt
    const audioResult = await context.run('generate-music', async () => {
      const result = await generateMusicForScene({
        prompt: musicPrompt.prompt,
        tags: reinforcedTags,
        duration: input.duration,
        instrumental: true,
        model: input.model || DEFAULT_MUSIC_MODEL,
        traceName: 'sequence-music',
        falApiKey: apiKeys.falApiKey,
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
    const model = input.model || DEFAULT_MUSIC_MODEL;
    const { teamId } = input;
    if (musicCost > 0 && !apiKeys.falApiKey) {
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
            sequenceId: input.sequenceId,
            duration: audioResult.metadata?.duration,
          },
        });
      });
    }

    // Step 3: Upload to storage
    const storageResult = await context.run('upload-to-storage', async () => {
      if (!audioResult.audioUrl) {
        throw new Error('Missing audio URL for storage upload');
      }

      const result = await uploadAudioToStorage({
        audioUrl: audioResult.audioUrl,
        teamId: input.teamId,
        sequenceId: input.sequenceId,
        sequenceTitle: 'sequence',
        sceneTitle: 'music',
      });

      if (!result.success || !result.path) {
        throw new Error('Failed to upload audio');
      }

      return { path: result.path, url: result.url };
    });

    const audioUrl = storageResult.url;

    // Step 4: Update sequence record
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

    // Step 5: Check if merged video is also ready — trigger mux if so
    await context.run('check-mux-trigger', async () => {
      const [seq] = await getDb()
        .select({
          mergedVideoStatus: sequences.mergedVideoStatus,
          mergedVideoUrl: sequences.mergedVideoUrl,
        })
        .from(sequences)
        .where(eq(sequences.id, sequenceId));

      if (
        seq?.mergedVideoStatus === 'completed' &&
        seq.mergedVideoUrl &&
        audioUrl
      ) {
        console.log(
          `[MusicWorkflow] Music + merged video both ready, triggering mux for sequence ${sequenceId}`
        );

        const muxInput: MergeAudioVideoWorkflowInput = {
          userId: input.userId,
          teamId: input.teamId,
          sequenceId: input.sequenceId,
          mergedVideoUrl: seq.mergedVideoUrl,
          musicUrl: audioUrl,
          durationMs: input.duration ? input.duration * 1000 : undefined,
        };

        await triggerWorkflow('/merge-audio-video', muxInput);
      }
    });

    console.log('[MusicWorkflow]', 'Music generation workflow completed');
    return { audioUrl, duration: actualDuration };
  },
  {
    retries: 3,
    retryDelay: 'pow(2, retried) * 1000',
    flowControl: getFalFlowControl(),
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
