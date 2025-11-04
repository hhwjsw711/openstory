/**
 * Frame generation workflow
 * Orchestrates script analysis, frame creation, and thumbnail generation
 */

import { generateImageWorkflow } from '@/app/api/workflows/[...any]/image-workflow';
import { generateMotionWorkflow } from '@/app/api/workflows/[...any]/motion-workflow';
import { DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL } from '@/lib/ai/models';
import { analyzeScriptForFrames } from '@/lib/ai/script-analyzer';
import { db } from '@/lib/db/client';
import { updateSequenceMetadata } from '@/lib/db/helpers/sequences';
import { sequences } from '@/lib/db/schema';
import { DirectorDnaConfigSchema } from '@/lib/services/director-dna-types';
import { frameService } from '@/lib/services/frame.service';
import { LoggerService } from '@/lib/services/logger.service';
import type {
  FrameGenerationWorkflowInput,
  ImageWorkflowInput,
  MotionWorkflowInput,
} from '@/lib/workflow';
import { validateWorkflowAuth } from '@/lib/workflow';
import {
  WorkflowValidationError,
  isInvalidScriptError,
} from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/nextjs';
import { eq } from 'drizzle-orm';

const loggerService = new LoggerService('FrameGenerationWorkflow');

export const generateStoryboardWorkflow = createWorkflow(
  async (context: WorkflowContext<FrameGenerationWorkflowInput>) => {
    const input = context.requestPayload;

    // Validate authentication
    validateWorkflowAuth(input);

    loggerService.logDebug(
      `Starting frame generation workflow for sequence ${input.sequenceId}`
    );

    // Step 1: Verify sequence and get data
    const sequence = await context.run('verify-sequence', async () => {
      const data = await db.query.sequences.findFirst({
        where: eq(sequences.id, input.sequenceId),
        with: {
          style: true,
        },
      });

      if (!data) {
        throw new WorkflowValidationError(
          `Sequence not found: ${input.sequenceId}`
        );
      }

      if (!data.script || data.script.trim().length === 0) {
        throw new WorkflowValidationError('Sequence has no script');
      }

      if (!data.styleId) {
        throw new WorkflowValidationError('Sequence has no style selected');
      }

      return data;
    });

    // Step 2: Update sequence status to processing
    await context.run('update-status-processing', async () => {
      await updateSequenceMetadata(
        input.sequenceId,
        {
          frameGeneration: {
            startedAt: new Date().toISOString(),
            expectedFrameCount: null,
            completedFrameCount: 0,
            options: input.options,
            error: null,
            failedAt: null,
          },
        },
        { status: 'processing' }
      );
    });

    // Step 3: Delete existing frames
    await context.run('delete-existing-frames', async () => {
      const existingFrames = await frameService.getFramesBySequence(
        input.sequenceId
      );

      if (existingFrames.length > 0) {
        await Promise.all(
          existingFrames.map((frame) => frameService.deleteFrame(frame.id))
        );
      }
    });

    // Step 4: Analyze script to determine frame boundaries
    const { scriptAnalysis, analysisDurationMs } = await context.run(
      'analyze-script',
      async () => {
        // Get or use default style
        const styleId = sequence.styleId;
        if (!styleId) {
          throw new WorkflowValidationError('No style ID found');
        }

        if (!sequence.style) {
          throw new WorkflowValidationError('No style found');
        }

        if (!sequence.script) {
          throw new WorkflowValidationError('No script found');
        }

        const styleConfig = DirectorDnaConfigSchema.parse(
          sequence.style.config
        );

        // Use the sequence's analysisModel for script analysis
        const analysisModel =
          sequence.analysisModel || 'anthropic/claude-haiku-4.5';

        let result;

        try {
          result = await analyzeScriptForFrames(
            sequence.script,
            styleConfig,
            analysisModel,
            {
              sequenceId: input.sequenceId,
              teamId: input.teamId,
              userId: input.userId,
            }
          );
        } catch (error) {
          // Check if error indicates invalid script
          if (isInvalidScriptError(error)) {
            throw new WorkflowValidationError(
              error instanceof Error
                ? error.message
                : 'Script is invalid or not a proper script format'
            );
          }

          // Update metadata with error for retryable errors
          await updateSequenceMetadata(input.sequenceId, {
            frameGeneration: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Script analysis failed',
            },
          });

          // Re-throw so QStash will retry
          throw error;
        }

        // Validate analysis result
        if (!result.analysis?.scenes || result.analysis.scenes.length === 0) {
          throw new WorkflowValidationError(
            'Script analysis returned no scenes - script may be too short or invalid'
          );
        }

        return {
          scriptAnalysis: result.analysis,
          analysisDurationMs: result.durationMs,
        };
      }
    );

    const frameCount = scriptAnalysis.scenes.length;

    // Step 5: Update sequence with title and analysis duration
    await context.run('update-title-and-duration', async () => {
      const updateData: {
        analysisDurationMs: number;
        title?: string;
        updatedAt: Date;
      } = {
        analysisDurationMs,
        updatedAt: new Date(),
      };

      // Set title from projectMetadata if available
      if (scriptAnalysis.projectMetadata?.title) {
        updateData.title = scriptAnalysis.projectMetadata.title;
      }

      await db
        .update(sequences)
        .set(updateData)
        .where(eq(sequences.id, input.sequenceId));
    });

    // Step 6: Update metadata with expected frame count
    await context.run('update-expected-count', async () => {
      await updateSequenceMetadata(input.sequenceId, {
        frameGeneration: {
          expectedFrameCount: frameCount,
          completedFrameCount: 0,
          error: null,
          failedAt: null,
          thumbnailsGenerating: true,
        },
      });
    });

    // Step 7: Create all frames using bulk insert
    const frameIds = await context.run('create-frames', async () => {
      // Build array of all frames to create
      const frameInserts = scriptAnalysis.scenes.map((scene, index) => ({
        sequenceId: input.sequenceId,
        description: scene.originalScript.extract,
        orderIndex: index,
        metadata: scene, // Store Scene object directly
      }));

      // Bulk insert all frames at once
      const createdFrames = await frameService.bulkInsertFrames(frameInserts);

      // Map frames to their prompts for thumbnail generation
      return createdFrames.map((frame) => {
        const scene = frame.metadata;
        const visualPrompt = scene?.prompts?.visual?.fullPrompt || '';
        const motionPrompt = scene?.prompts?.motion?.fullPrompt || '';
        const duration = scene?.metadata?.durationSeconds || 3000;
        return {
          frameId: frame.id,
          prompt: visualPrompt,
          motionPrompt,
          duration,
        };
      });
    });

    // Step 8: Generate thumbnails in parallel if enabled
    if (input.options?.generateThumbnails !== false) {
      await Promise.all(
        frameIds.map(async ({ frameId, prompt, motionPrompt, duration }) => {
          // Trigger image generation for all frames in parallel
          if (!prompt) {
            loggerService.logWarning(
              `Frame ${frameId} has no description, skipping`
            );
            return null;
          }
          // Generate image for the frame
          const imageInput: ImageWorkflowInput = {
            userId: input.userId,
            teamId: input.teamId,
            prompt,
            model: DEFAULT_IMAGE_MODEL,
            imageSize: 'landscape_16_9',
            numImages: 1,
            frameId,
            sequenceId: input.sequenceId,
          };

          const {
            body: imageBody,
            isFailed: imageIsFailed,
            isCanceled: imageIsCanceled,
          } = await context.invoke('image', {
            workflow: generateImageWorkflow,
            body: imageInput,
          });

          if (imageIsFailed || imageIsCanceled || !imageBody.imageUrl) {
            throw new WorkflowValidationError(
              `Image generation failed for frame ${frameId}, skipping motion generation`
            );
          }

          // Trigger motion generation workflow
          const motionInput: MotionWorkflowInput = {
            userId: input.userId,
            teamId: input.teamId,
            frameId,
            sequenceId: input.sequenceId,
            thumbnailUrl: imageBody.imageUrl,
            prompt: motionPrompt,
            model: DEFAULT_VIDEO_MODEL,
            duration: duration,
          };

          await context.invoke('motion', {
            workflow: generateMotionWorkflow,
            body: motionInput,
          });
        })
      );
    }

    // Step 9: Update sequence status to completed
    await context.run('update-sequence-status', async () => {
      try {
        await db
          .update(sequences)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(sequences.id, input.sequenceId));

        loggerService.logDebug('Sequence status updated to completed');
        return { success: true };
      } catch (error) {
        loggerService.logError(
          `Failed to update sequence status: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        throw new Error(
          `Failed to update sequence status: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    loggerService.logDebug('Frame generation workflow completed');

    return {
      sequenceId: input.sequenceId,
      frameCount,
      message:
        input.options?.generateThumbnails !== false
          ? `Created ${frameCount} frames. Thumbnail generation is in progress.`
          : `Created ${frameCount} frames.`,
    };
  },
  {
    retries: 3,
    retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      // Set status to 'failed' after all retries exhausted
      await updateSequenceMetadata(
        input.sequenceId,
        {
          frameGeneration: {
            error: failResponse,
            failedAt: new Date().toISOString(),
          },
        },
        { status: 'failed' }
      );

      loggerService.logError(
        `Frame generation workflow failed for sequence ${input.sequenceId}: ${failResponse}`
      );

      return `Frame generation failed for sequence ${input.sequenceId}`;
    },
  }
);
