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
import { getFalFlowControl } from '@/lib/workflows/constants';
import { durableLLMCall } from './llm-call-helper';
import {
  musicPromptSchema,
  reinforceInstrumentalTags,
} from './music-prompt.schema';

import { eq } from 'drizzle-orm';

export const generateMusicWorkflow = createWorkflow(
  async (context: WorkflowContext<MusicWorkflowInput>) => {
    const input = context.requestPayload;

    const hasPreGeneratedPrompt = !!input.prompt && !!input.tags;
    const hasScenes = !!input.scenes && input.scenes.length > 0;

    if (!hasPreGeneratedPrompt && !hasScenes) {
      throw new WorkflowValidationError(
        'Either prompt+tags or scenes are required for music generation'
      );
    }

    const { sequenceId, teamId } = input;
    const model = input.model || DEFAULT_MUSIC_MODEL;

    // Step 1: Set status to generating
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

    // Resolve team API keys
    const apiKeys = await context.run('resolve-api-keys', async () => {
      return resolveWorkflowApiKeys(teamId);
    });

    // Step 2: Use pre-generated prompt or fall back to LLM generation from scenes
    let effectivePrompt: string;
    let effectiveTags: string;

    if (hasPreGeneratedPrompt && input.prompt && input.tags) {
      effectivePrompt = input.prompt;
      effectiveTags = input.tags;
    } else {
      // Legacy fallback: generate prompt from scenes
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
          teamId,
          openRouterApiKey: apiKeys.openRouterApiKey,
        }
      );
      effectivePrompt = musicPrompt.prompt;
      // Reinforce instrumental -- ACE-Step sometimes generates vocals despite [inst]
      effectiveTags = reinforceInstrumentalTags(musicPrompt.tags);
    }

    // Step 3: Generate music using prompt
    const audioResult = await context.run('generate-music', async () => {
      const result = await generateMusicForScene({
        prompt: effectivePrompt,
        tags: effectiveTags,
        duration: input.duration,
        instrumental: true,
        model,
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
            sequenceId,
            duration: audioResult.metadata?.duration,
          },
        });
      });
    }

    // Step 4: Upload to storage
    const storageResult = await context.run('upload-to-storage', async () => {
      if (!audioResult.audioUrl) {
        throw new Error('Missing audio URL for storage upload');
      }

      const result = await uploadAudioToStorage({
        audioUrl: audioResult.audioUrl,
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

    const audioUrl = storageResult.url;

    // Step 5: Update sequence record
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

    // Step 6: Check if merged video is also ready -- trigger mux if so
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
          teamId,
          sequenceId,
          mergedVideoUrl: seq.mergedVideoUrl,
          musicUrl: audioUrl,
          durationMs: undefined,
        };

        await triggerWorkflow('/merge-audio-video', muxInput, {
          flowControl: getFalFlowControl(),
        });
      }
    });

    console.log('[MusicWorkflow]', 'Music generation workflow completed');
    return { audioUrl, duration: actualDuration };
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
