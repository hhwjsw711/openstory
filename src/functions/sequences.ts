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
import { getSequenceById } from '@/lib/db/helpers/queries';
import {
  createSequence,
  deleteSequence,
  getSequencesByTeam,
  updateSequence,
} from '@/lib/db/helpers/sequences';
import { requireTeamMemberAccess } from '@/lib/auth/action-utils';
import {
  DEFAULT_ANALYSIS_MODEL,
  getAnalysisModelById,
} from '@/lib/ai/models.config';
import { DEFAULT_ASPECT_RATIO } from '@/lib/constants/aspect-ratios';
import { triggerWorkflow } from '@/lib/workflow/client';
import type { StoryboardWorkflowInput } from '@/lib/workflow/types';
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
  .handler(async ({ context }) => {
    return getSequencesByTeam(context.teamId);
  });

// ============================================================================
// Get Single Sequence
// ============================================================================

const getSequenceInputSchema = z.object({
  sequenceId: ulidSchema,
});

/**
 * Get a single sequence by ID
 * @param sequenceId - The sequence ID
 * @returns The sequence with optional frames
 */
export const getSequenceFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(getSequenceInputSchema))
  .handler(async ({ context }) => {
    return context.sequence;
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
  .handler(async ({ data, context }) => {
    const teamId = data.teamId || context.teamId;

    // Verify user has access if a different team was specified
    if (data.teamId && data.teamId !== context.teamId) {
      await requireTeamMemberAccess(context.user.id, data.teamId);
    }

    const { styleId, aspectRatio } = data;
    if (!styleId || !aspectRatio) {
      throw new Error('Style ID and aspect ratio are required');
    }

    const {
      analysisModels,
      imageModel,
      videoModel,
      autoGenerateMotion,
      suggestedTalentIds,
    } = data;

    // Create sequences in parallel for each selected model
    const sequences = await Promise.all(
      analysisModels.map(async (modelId) => {
        const sequence = await createSequence({
          teamId,
          userId: context.user.id,
          title: data.title || 'Untitled Sequence',
          script: data.script,
          styleId,
          aspectRatio,
          analysisModel:
            getAnalysisModelById(modelId)?.id || DEFAULT_ANALYSIS_MODEL,
          imageModel,
          videoModel,
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
          suggestedTalentIds,
        };

        await triggerWorkflow('/storyboard', workflowInput, {
          deduplicationId: `storyboard-${sequence.id}`,
        });

        return sequence;
      })
    );

    return JSON.parse(JSON.stringify(sequences)) satisfies Sequence[];
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
  .handler(async ({ data, context }) => {
    const { sequenceId, ...updateData } = data;

    // Check if we need to regenerate the storyboard
    const needToRegenerateStoryboard =
      updateData.script !== undefined ||
      updateData.styleId !== undefined ||
      updateData.aspectRatio !== undefined ||
      updateData.analysisModel !== undefined;

    // Update sequence
    const sequence = await updateSequence({
      id: sequenceId,
      userId: context.user.id,
      aspectRatio: updateData.aspectRatio ?? DEFAULT_ASPECT_RATIO,
      ...updateData,
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

    return JSON.parse(JSON.stringify(sequence)) satisfies Sequence;
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
    await deleteSequence(data.sequenceId);

    return { success: true };
  });
