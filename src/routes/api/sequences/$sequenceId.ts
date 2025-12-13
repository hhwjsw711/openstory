/**
 * Sequence API Endpoint (TanStack Start)
 * GET /api/sequences/:sequenceId - Get a sequence by ID
 * PATCH /api/sequences/:sequenceId - Update a sequence
 * DELETE /api/sequences/:sequenceId - Delete a sequence
 */

import { errorResponse, json, successResponse } from '@/lib/api/response';
import { requireTeamMemberAccess } from '@/lib/auth/action-utils';
import { requireAuth } from '@/lib/auth/api-utils';
import { DEFAULT_ASPECT_RATIO } from '@/lib/constants/aspect-ratios';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { handleApiError, ValidationError } from '@/lib/errors';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { updateSequenceSchema } from '@/lib/schemas/sequence.schemas';
import { sequenceService } from '@/lib/services/sequence.service';
import type { StoryboardWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/sequences/$sequenceId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const { sequenceId } = params;

          // Validate ULID
          try {
            ulidSchema.parse(sequenceId);
          } catch {
            throw new ValidationError('Invalid sequence ID format');
          }

          // Authenticate user
          const authResult = await requireAuth(request);
          const user = authResult.user;

          // Verify user has access to the sequence's team
          const seq = await getSequenceById(sequenceId);

          if (seq) {
            await requireTeamMemberAccess(user.id, seq.teamId);
          }

          // Parse search params to determine if frames should be included
          const url = new URL(request.url);
          const includeFrames = url.searchParams.get('frames') === 'true';

          const sequence = await sequenceService.getSequence(
            sequenceId,
            includeFrames
          );

          return successResponse(sequence);
        } catch (error) {
          console.error('[GET /api/sequences/$sequenceId] Error:', error);

          const handledError = handleApiError(error);
          return errorResponse(
            'Failed to get sequence',
            handledError.statusCode,
            { error: handledError.toJSON() }
          );
        }
      },

      PATCH: async ({ request, params }) => {
        try {
          const { sequenceId } = params;

          // Validate ULID
          try {
            ulidSchema.parse(sequenceId);
          } catch {
            throw new ValidationError('Invalid sequence ID format');
          }

          // Authenticate user
          const authResult = await requireAuth(request);
          const user = authResult.user;

          // Parse and validate request body
          const body = await request.json();
          const sequenceDetailsToUpdate = updateSequenceSchema.parse(body);

          // Verify sequence exists and get team info
          const existingSeq = await getSequenceById(sequenceId);

          if (!existingSeq) {
            return json(
              {
                success: false,
                message: 'Sequence not found',
                timestamp: new Date().toISOString(),
              },
              { status: 404 }
            );
          }
          // Verify user has access to this sequence's team
          await requireTeamMemberAccess(user.id, existingSeq.teamId);

          // Check if we need to regenerate the storyboard
          // Only regenerate when fields that affect storyboard content are changed
          const needToRegenerateStoryboard =
            sequenceDetailsToUpdate.script !== undefined ||
            sequenceDetailsToUpdate.styleId !== undefined ||
            sequenceDetailsToUpdate.aspectRatio !== undefined ||
            sequenceDetailsToUpdate.analysisModel !== undefined;

          // Update sequence
          const sequence = await sequenceService.updateSequence({
            id: sequenceId,
            userId: user.id,
            aspectRatio:
              sequenceDetailsToUpdate.aspectRatio ?? DEFAULT_ASPECT_RATIO,
            ...sequenceDetailsToUpdate,
            metadata: sequenceDetailsToUpdate.metadata ?? undefined,
            status: needToRegenerateStoryboard ? 'processing' : undefined,
          });

          // If script or style changed, regenerate frames
          if (needToRegenerateStoryboard) {
            if (existingSeq.status === 'processing') {
              // We need to cancel the current processing workflow
              // await cancelWorkflow(existingSeq.workflowRunId);
            }

            // Trigger frame generation workflow
            const workflowInput: StoryboardWorkflowInput = {
              userId: user.id,
              teamId: existingSeq.teamId,
              sequenceId,
              options: {
                framesPerScene: 3,
                generateThumbnails: true,
                generateDescriptions: true,
                aiProvider: 'openrouter',
                regenerateAll: true,
              },
            };

            // Publish to QStash to trigger the workflow
            await triggerWorkflow('/storyboard', workflowInput);
          }

          // TODO: Implement cache invalidation for TanStack Query
          // revalidatePath(`/sequences/${sequenceId}`);
          // revalidatePath(`/sequences/${sequenceId}/script`);
          // revalidatePath(`/sequences/${sequenceId}/scenes`);

          return successResponse(sequence, 'Sequence updated successfully');
        } catch (error) {
          console.error('[PATCH /api/sequences/$sequenceId] Error:', error);
          const handledError = handleApiError(error);
          return errorResponse(
            'Failed to update sequence',
            handledError.statusCode,
            { error: handledError.toJSON() }
          );
        }
      },

      DELETE: async ({ request, params }) => {
        try {
          const { sequenceId } = params;

          // Validate ULID
          try {
            ulidSchema.parse(sequenceId);
          } catch {
            throw new ValidationError('Invalid sequence ID format');
          }

          // Authenticate user
          const authResult = await requireAuth(request);
          const user = authResult.user;

          // Get the sequence to verify team ownership
          const sequence = await getSequenceById(sequenceId);

          if (!sequence) {
            return json(
              {
                success: false,
                message: 'Sequence not found',
                timestamp: new Date().toISOString(),
              },
              { status: 404 }
            );
          }

          // Require admin access to delete
          await requireTeamMemberAccess(user.id, sequence.teamId, 'admin');

          // Delete the sequence (frames will be cascade deleted)
          await sequenceService.deleteSequence(sequenceId);

          // TODO: Implement cache invalidation for TanStack Query
          // revalidatePath('/sequences');
          // revalidatePath(`/sequences/${sequenceId}`);

          return successResponse(
            undefined,
            'Sequence deleted successfully',
            200
          );
        } catch (error) {
          console.error('[DELETE /api/sequences/$sequenceId] Error:', error);
          const handledError = handleApiError(error);
          return errorResponse(
            'Failed to delete sequence',
            handledError.statusCode,
            { error: handledError.toJSON() }
          );
        }
      },
    },
  },
});
