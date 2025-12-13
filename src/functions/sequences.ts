/**
 * Sequence Server Functions
 * End-to-end type-safe functions for sequence operations
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import {
  authMiddleware,
  authWithTeamMiddleware,
  sequenceAccessMiddleware,
} from './middleware';
import {
  createSequenceSchema,
  updateSequenceSchema,
} from '@/lib/schemas/sequence.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import {
  sequenceService,
  type SequenceWithDetails,
} from '@/lib/services/sequence.service';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { requireTeamMemberAccess } from '@/lib/auth/action-utils';
import {
  DEFAULT_ANALYSIS_MODEL,
  getAnalysisModelById,
} from '@/lib/ai/models.config';
import { DEFAULT_ASPECT_RATIO } from '@/lib/constants/aspect-ratios';
import { triggerWorkflow } from '@/lib/workflow';
import type { StoryboardWorkflowInput } from '@/lib/workflow';
import type { Sequence } from '@/lib/db/schema';

// ============================================================================
// List Sequences
// ============================================================================

/**
 * Get all sequences for the user's default team
 * @returns Array of sequences
 */
export const getSequencesFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  // @ts-expect-error - Deep type inference issue with SequenceMetadata index signature
  .handler(async ({ context }) => {
    return sequenceService.getSequencesByTeam(context.teamId);
  });

// ============================================================================
// Get Single Sequence
// ============================================================================

const getSequenceInputSchema = z.object({
  sequenceId: ulidSchema,
  includeFrames: z.boolean().default(false),
});

/**
 * Get a single sequence by ID
 * @param sequenceId - The sequence ID
 * @param includeFrames - Whether to include frames (default: false)
 * @returns The sequence with optional frames
 */
export const getSequenceFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(getSequenceInputSchema))
  // @ts-expect-error - Deep type inference issue with SequenceMetadata index signature
  .handler(async ({ data, context }) => {
    // Verify user has access to the sequence's team
    const seq = await getSequenceById(data.sequenceId);

    if (!seq) {
      throw new Error('Sequence not found');
    }

    await requireTeamMemberAccess(context.user.id, seq.teamId);

    return sequenceService.getSequence(data.sequenceId, data.includeFrames);
  });

// ============================================================================
// Create Sequence
// ============================================================================

/**
 * Create new sequence(s)
 * Supports creating multiple sequences with different analysis models
 * @returns Array of created sequences
 */
export const createSequenceFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(createSequenceSchema))
  // @ts-expect-error - Deep type inference issue with SequenceMetadata index signature
  .handler(async ({ data, context }) => {
    const teamId = data.teamId || context.teamId;

    // Verify user has access if a different team was specified
    if (data.teamId && data.teamId !== context.teamId) {
      await requireTeamMemberAccess(context.user.id, data.teamId);
    }

    if (!data.styleId || !data.aspectRatio) {
      throw new Error('Style ID and aspect ratio are required');
    }

    const { analysisModels, imageModel, videoModel, autoGenerateMotion } = data;

    // Create sequences in parallel for each selected model
    const sequences = await Promise.all(
      analysisModels.map(async (modelId) => {
        const sequence = await sequenceService.createSequence({
          teamId,
          userId: context.user.id,
          title: data.title || 'Untitled Sequence',
          script: data.script,
          styleId: data.styleId!,
          aspectRatio: data.aspectRatio!,
          analysisModel:
            getAnalysisModelById(modelId)?.id || DEFAULT_ANALYSIS_MODEL,
          imageModel,
          videoModel,
          autoGenerateMotion: false,
        });

        // Trigger storyboard generation workflow
        const workflowInput: StoryboardWorkflowInput = {
          userId: context.user.id,
          teamId,
          sequenceId: sequence.id,
          options: {
            framesPerScene: 3,
            generateThumbnails: true,
            generateDescriptions: true,
            aiProvider: 'openrouter',
            regenerateAll: true,
          },
          autoGenerateMotion: autoGenerateMotion ?? false,
        };

        await triggerWorkflow('/storyboard', workflowInput, {
          deduplicationId: `storyboard-${sequence.id}`,
        });

        return sequence;
      })
    );

    return JSON.parse(JSON.stringify(sequences)) as Sequence[];
  });

// ============================================================================
// Update Sequence
// ============================================================================

const updateSequenceInputSchema = updateSequenceSchema.extend({
  sequenceId: ulidSchema,
});

/**
 * Update a sequence
 * Triggers storyboard regeneration if script/style/aspectRatio/model changes
 * @returns The updated sequence
 */
export const updateSequenceFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(updateSequenceInputSchema))
  // @ts-expect-error - Deep type inference issue with SequenceMetadata index signature
  .handler(async ({ data, context }) => {
    const { sequenceId, ...updateData } = data;

    // Check if we need to regenerate the storyboard
    const needToRegenerateStoryboard =
      updateData.script !== undefined ||
      updateData.styleId !== undefined ||
      updateData.aspectRatio !== undefined ||
      updateData.analysisModel !== undefined;

    // Update sequence
    const sequence = await sequenceService.updateSequence({
      id: sequenceId,
      userId: context.user.id,
      aspectRatio: updateData.aspectRatio ?? DEFAULT_ASPECT_RATIO,
      ...updateData,
      metadata: updateData.metadata ?? undefined,
      status: needToRegenerateStoryboard ? 'processing' : undefined,
    });

    // Trigger storyboard regeneration if needed
    if (needToRegenerateStoryboard) {
      const workflowInput: StoryboardWorkflowInput = {
        userId: context.user.id,
        teamId: context.teamId,
        sequenceId,
        options: {
          framesPerScene: 3,
          generateThumbnails: true,
          generateDescriptions: true,
          aiProvider: 'openrouter',
          regenerateAll: true,
        },
      };

      await triggerWorkflow('/storyboard', workflowInput);
    }

    return JSON.parse(JSON.stringify(sequence)) as Sequence;
  });

// ============================================================================
// Delete Sequence
// ============================================================================

const deleteSequenceInputSchema = z.object({
  sequenceId: ulidSchema,
});

/**
 * Delete a sequence (requires admin role)
 */
export const deleteSequenceFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(deleteSequenceInputSchema))
  .handler(async ({ data, context }) => {
    // Get the sequence to verify team ownership
    const sequence = await getSequenceById(data.sequenceId);

    if (!sequence) {
      throw new Error('Sequence not found');
    }

    // Require admin access to delete
    await requireTeamMemberAccess(context.user.id, sequence.teamId, 'admin');

    // Delete the sequence (frames will be cascade deleted)
    await sequenceService.deleteSequence(data.sequenceId);

    return { success: true };
  });
