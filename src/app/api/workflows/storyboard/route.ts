/**
 * Frame generation workflow
 * Orchestrates script analysis, frame creation, and thumbnail generation
 */

import { serve } from '@upstash/workflow/nextjs';
import { analyzeScriptForFrames } from '@/lib/ai/script-analyzer';
import { DirectorDnaConfigSchema } from '@/lib/services/director-dna-types';
import type { CreateFrameParams } from '@/lib/services/frame.service';
import { frameService } from '@/lib/services/frame.service';
import { LoggerService } from '@/lib/services/logger.service';
import type {
  FrameGenerationWorkflowInput,
  ImageWorkflowInput,
} from '@/lib/workflow';
import {
  getQStashClient,
  validateWorkflowAuth,
  workflowConfig,
} from '@/lib/workflow';
import { db } from '@/lib/db/client';
import { sequences } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Common cinematography shot types for variety
const ShotTypes = [
  'establishing',
  'wide',
  'medium',
  'close-up',
  'extreme-close-up',
  'over-the-shoulder',
  'point-of-view',
] as const;

const loggerService = new LoggerService('FrameGenerationWorkflow');

export const { POST } = serve<FrameGenerationWorkflowInput>(async (context) => {
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
      throw new Error(`Sequence not found: ${input.sequenceId}`);
    }

    if (!data.script) {
      throw new Error('Sequence has no script');
    }

    if (!data.styleId) {
      throw new Error('Sequence has no style selected');
    }

    return data;
  });

  // Step 2: Update sequence status to processing
  await context.run('update-status-processing', async () => {
    await db
      .update(sequences)
      .set({
        status: 'processing',
        metadata: {
          frameGeneration: {
            status: 'processing',
            startedAt: new Date().toISOString(),
            expectedFrameCount: null,
            completedFrameCount: 0,
            options: input.options,
            error: null,
            failedAt: null,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(sequences.id, input.sequenceId));
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
  const scriptAnalysis = await context.run('analyze-script', async () => {
    // Get or use default style
    const styleId = sequence.styleId;
    if (!styleId) {
      throw new Error('No style ID found');
    }

    if (!sequence.style) {
      throw new Error('No style found');
    }

    const styleConfig = DirectorDnaConfigSchema.parse(sequence.style.config);

    const analysis = await analyzeScriptForFrames(
      sequence.script || '',
      styleConfig
    );

    if (!analysis?.scenes || analysis.scenes.length === 0) {
      throw new Error('Failed to analyze script or no scenes found');
    }

    return analysis;
  });

  const frameCount = scriptAnalysis.scenes.length;

  // Step 5: Update metadata with expected frame count
  await context.run('update-expected-count', async () => {
    await db
      .update(sequences)
      .set({
        metadata: {
          frameGeneration: {
            status: 'generating_thumbnails',
            startedAt: new Date().toISOString(),
            expectedFrameCount: frameCount,
            completedFrameCount: 0,
            options: input.options,
            error: null,
            failedAt: null,
            thumbnailsGenerating: true,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(sequences.id, input.sequenceId));
  });

  // Step 6: Process all scenes in parallel
  const frameIds = await context.run('process-scenes', async () => {
    const promises = scriptAnalysis.scenes.map(async (scene, index) => {
      const serviceStartTime = Date.now();
      const orderIndex = index;

      // Get or use default style
      const styleId = sequence.styleId;
      if (!styleId) {
        throw new Error('No style ID found');
      }

      const shotTypes = ShotTypes[orderIndex % ShotTypes.length];
      const originalSceneScript = scene.scriptContent;

      const serviceEndTime = Date.now();
      const serviceDurationMs = serviceEndTime - serviceStartTime;

      // Create frame record
      const frameData: CreateFrameParams = {
        description: scene.scriptContent,
        orderIndex,
        durationMs: serviceDurationMs,
        sequenceId: input.sequenceId,
        metadata: {
          scene: orderIndex,
          scriptChunk: scene.scriptContent,
          shotType: shotTypes,
          sceneType: scene.type,
          sceneIntensity: scene.intensity,
          characters: scriptAnalysis.characters || [],
          settings: scriptAnalysis.settings || [],
          durationMs: serviceDurationMs,
          startTime: new Date(serviceStartTime).toISOString(),
          endTime: new Date(serviceEndTime).toISOString(),
          userId: input.userId,
          teamId: input.teamId,
          shouldGenerateImage: input.options?.generateThumbnails !== false,
          originalSceneScript,
        },
      };

      const frame = await frameService.createFrame(frameData);
      return { frameId: frame.id, prompt: scene.scriptContent };
    });

    return await Promise.all(promises);
  });

  // Step 7: Generate thumbnails in parallel if enabled
  if (input.options?.generateThumbnails !== false) {
    await context.run('generate-thumbnails', async () => {
      const qstash = getQStashClient();

      // Trigger image generation for all frames in parallel
      const promises = frameIds.map(async ({ frameId, prompt }) => {
        if (!prompt) {
          loggerService.logWarning(
            `Frame ${frameId} has no description, skipping`
          );
          return null;
        }

        const imageInput: ImageWorkflowInput = {
          userId: input.userId,
          teamId: input.teamId,
          prompt,
          model: 'flux_krea_lora',
          imageSize: 'landscape_16_9',
          numImages: 1,
          frameId,
          sequenceId: input.sequenceId,
        };

        // Publish to QStash to trigger image workflow (fire and forget)
        try {
          await qstash.publishJSON({
            url: `${workflowConfig.baseUrl}/image`,
            body: imageInput,
          });
          return frameId;
        } catch (error) {
          loggerService.logError(
            `Failed to trigger image workflow for frame ${frameId}: ${error instanceof Error ? error.message : 'Unknown'}`
          );
          return null;
        }
      });

      await Promise.all(promises);
      return { triggered: promises.length };
    });
  }

  // Step N: Update sequence status to completed
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
});
