import { getGenerationChannel } from '@/lib/realtime';
import { sanitizeFailResponse } from '@/lib/workflow/sanitize-fail-response';
import { createScopedWorkflow } from '@/lib/workflow/scoped-workflow';
import type {
  MusicPromptWorkflowInput,
  MusicPromptWorkflowResult,
} from '@/lib/workflow/types';
import { musicDesignResultSchema } from '../ai/response-schemas';
import { reinforceInstrumentalTags } from '../prompts/music-prompt';
import { durableLLMCall } from './llm-call-helper';

export const generateMusicPromptWorflow = createScopedWorkflow<
  MusicPromptWorkflowInput,
  MusicPromptWorkflowResult
>(
  async (context, scopedDb) => {
    const input = context.requestPayload;
    const { sceneSummaries, analysisModelId, sequenceId } = input;

    const llmCallContext = {
      sequenceId,
      userId: input.userId,
      scopedDb,
    };

    const musicDesignResult: MusicPromptWorkflowResult = await durableLLMCall(
      context,
      {
        name: 'music-prompt-generation',
        phase: { number: 6, name: 'Composing music\u2026' },
        promptName: 'phase/music-design-chat',
        promptVariables: {
          scenes: JSON.stringify(sceneSummaries, null, 2),
        },
        modelId: analysisModelId,
        responseSchema: musicDesignResultSchema,
      },
      llmCallContext
    );

    // Now save the music prompt to the database
    if (sequenceId) {
      await context.run('save-music-prompt-to-db', async () => {
        const reinforcedTags = reinforceInstrumentalTags(
          musicDesignResult.tags
        );
        await scopedDb.sequences.updateMusicPrompt(
          sequenceId,
          musicDesignResult.prompt,
          reinforcedTags
        );
      });
    }

    return musicDesignResult;
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
