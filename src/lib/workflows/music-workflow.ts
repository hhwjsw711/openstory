/**
 * Music generation workflow
 * Generates background music/audio for frames using audioDesign specifications
 */

import { getFrameWithSequence, updateFrame } from '@/lib/db/helpers/frames';
import type { MusicWorkflowInput } from '@/lib/workflow/types';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import { getGenerationChannel } from '@/lib/realtime';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { generateMusicForScene } from '@/lib/audio/music-generation';
import { uploadAudioToStorage } from '@/lib/audio/audio-storage';
import { DEFAULT_MUSIC_MODEL } from '@/lib/ai/models';
import { resolveWorkflowApiKeys } from '@/lib/workflow/resolve-keys';
import { getFalFlowControl } from './constants';

export const generateMusicWorkflow = createWorkflow(
  async (context: WorkflowContext<MusicWorkflowInput>) => {
    const input = context.requestPayload;

    if (!input.prompt || input.prompt.trim().length === 0) {
      throw new WorkflowValidationError(
        'Prompt is required for music generation'
      );
    }

    // Step 1: Set status to generating
    const { frameDeleted } = await context.run(
      'set-generating-status',
      async () => {
        if (input.frameId) {
          const frame = await updateFrame(
            input.frameId,
            {
              audioStatus: 'generating',
              audioWorkflowRunId: context.workflowRunId,
              audioModel: input.model || DEFAULT_MUSIC_MODEL,
            },
            { throwOnMissing: false }
          );

          if (!frame) {
            console.log(
              '[MusicWorkflow]',
              `Frame ${input.frameId} was deleted, skipping workflow`
            );
            return { frameDeleted: true };
          }

          if (input.sequenceId) {
            await getGenerationChannel(input.sequenceId).emit(
              'generation.audio:progress',
              {
                frameId: input.frameId,
                status: 'generating',
              }
            );
          }
        }
        return { frameDeleted: false };
      }
    );

    if (frameDeleted) {
      return { audioUrl: '', duration: 0 };
    }

    // Resolve team API keys
    const apiKeys = await context.run('resolve-api-keys', async () => {
      return resolveWorkflowApiKeys(input.teamId);
    });

    // Step 2: Generate music
    const audioResult = await context.run('generate-music', async () => {
      const result = await generateMusicForScene({
        prompt: input.prompt,
        tags: input.tags,
        duration: input.duration,
        instrumental: true,
        model: input.model || DEFAULT_MUSIC_MODEL,
        traceName: 'frame-music',
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
    if (musicCost > 0 && teamId && !apiKeys.falApiKey) {
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
            frameId: input.frameId,
            sequenceId: input.sequenceId,
            duration: audioResult.metadata?.duration,
          },
        });
      });
    }

    let audioUrl: string = audioResult.audioUrl || '';

    if (input.frameId) {
      // Step 3: Fetch frame data for human-readable filename
      const frameData = await context.run('fetch-frame-data', async () => {
        if (!input.frameId) throw new Error('Frame ID required');
        const frame = await getFrameWithSequence(input.frameId);
        if (!frame) throw new Error('Frame not found');
        return {
          sequenceTitle: frame.sequence.title,
          sceneTitle: frame.metadata?.metadata?.title,
        };
      });

      // Step 4: Upload audio to storage
      const storageResult = await context.run('upload-to-storage', async () => {
        if (
          !audioResult.audioUrl ||
          !input.teamId ||
          !input.sequenceId ||
          !input.frameId
        ) {
          throw new Error('Missing required IDs for storage upload');
        }

        const result = await uploadAudioToStorage({
          audioUrl: audioResult.audioUrl,
          teamId: input.teamId,
          sequenceId: input.sequenceId,
          frameId: input.frameId,
          sequenceTitle: frameData.sequenceTitle,
          sceneTitle: frameData.sceneTitle,
        });

        if (!result.success || !result.path) {
          throw new Error('Failed to upload audio');
        }

        return { path: result.path, url: result.url };
      });

      audioUrl = storageResult.url;

      // Step 5: Update frame with audio path, URL, and status
      await context.run('update-frame', async () => {
        if (!audioUrl || !input.frameId) {
          throw new Error('Missing required data for frame update');
        }

        const updatedFrame = await updateFrame(
          input.frameId,
          {
            audioPath: storageResult.path,
            audioUrl: storageResult.url,
            audioStatus: 'completed',
            audioGeneratedAt: new Date(),
            audioError: null,
          },
          { throwOnMissing: false }
        );

        if (!updatedFrame) {
          console.log(
            '[MusicWorkflow]',
            `Frame ${input.frameId} was deleted, skipping final update`
          );
          return;
        }

        if (input.sequenceId) {
          await getGenerationChannel(input.sequenceId).emit(
            'generation.audio:progress',
            {
              frameId: input.frameId,
              status: 'completed',
              audioUrl: storageResult.url,
            }
          );
        }
      });
    }

    console.log('[MusicWorkflow]', 'Music generation workflow completed');
    return { audioUrl, duration: actualDuration };
  },
  {
    retries: 3,
    retryDelay: 'pow(2, retried) * 1000',
    flowControl: getFalFlowControl(),
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;
      if (input.frameId) {
        await updateFrame(
          input.frameId,
          {
            audioStatus: 'failed',
            audioError: failResponse,
          },
          { throwOnMissing: false }
        );
      }

      if (input.sequenceId && input.frameId) {
        try {
          await getGenerationChannel(input.sequenceId).emit(
            'generation.audio:progress',
            {
              frameId: input.frameId,
              status: 'failed',
            }
          );
        } catch {
          // Ignore emit errors
        }
      }

      console.error(
        '[MusicWorkflow]',
        `Music generation failed for frame ${input.frameId}: ${failResponse}`
      );

      return `Music generation failed for frame ${input.frameId}`;
    },
  }
);
