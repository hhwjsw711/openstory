/**
 * Generate Frames API Endpoint
 * POST /api/sequences/$sequenceId/frames/generate - Generate frames for a sequence
 */

import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { handleApiError, ValidationError } from '@/lib/errors';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import type { StoryboardWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';

export const Route = createFileRoute(
  '/api/sequences/$sequenceId/frames/generate'
)({
  server: {
    handlers: {
      POST: async ({ params }) => {
        try {
          const { sequenceId } = params;

          // Validate ULID
          try {
            ulidSchema.parse(sequenceId);
          } catch {
            throw new ValidationError('Invalid sequence ID format');
          }

          // Authenticate user
          const user = await requireUser();

          // Verify sequence exists and get team info
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

          // Verify user has access to this sequence
          await requireTeamMemberAccess(user.id, sequence.teamId);

          // Trigger frame generation workflow
          const workflowInput: StoryboardWorkflowInput = {
            userId: user.id,
            teamId: sequence.teamId,
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
          // Use deduplicationId to prevent duplicate workflows for the same sequence
          const workflowRunId = await triggerWorkflow(
            '/storyboard',
            workflowInput,
            {
              deduplicationId: `storyboard-${sequenceId}`,
            }
          );

          console.log('[generateFrames] Frame generation workflow triggered', {
            sequenceId,
            workflowRunId,
          });

          return json(
            {
              success: true,
              data: {
                workflowRunId,
                frames: [],
              },
              message: 'Frame generation started successfully',
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error(
            '[POST /api/sequences/$sequenceId/frames/generate] Error:',
            error
          );
          const handledError = handleApiError(error);
          return json(
            {
              success: false,
              message: 'Failed to generate frames',
              error: handledError.toJSON(),
              timestamp: new Date().toISOString(),
            },
            { status: handledError.statusCode }
          );
        }
      },
    },
  },
});
