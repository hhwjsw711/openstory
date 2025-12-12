/**
 * Frame API Endpoint
 * GET /api/sequences/$sequenceId/frames/$frameId - Get a single frame
 * PATCH /api/sequences/$sequenceId/frames/$frameId - Update a frame
 * DELETE /api/sequences/$sequenceId/frames/$frameId - Delete a frame
 */

import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getFrameWithSequence } from '@/lib/db/helpers/frames';
import { handleApiError, ValidationError } from '@/lib/errors';
import { updateFrameSchema } from '@/lib/schemas/frame.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { frameService } from '@/lib/services/frame.service';
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { z } from 'zod';

export const Route = createFileRoute(
  '/api/sequences/$sequenceId/frames/$frameId'
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { sequenceId, frameId } = params;

          // Validate ULIDs
          try {
            ulidSchema.parse(sequenceId);
            ulidSchema.parse(frameId);
          } catch {
            throw new ValidationError('Invalid sequence or frame ID format');
          }

          // Authenticate user
          const user = await requireUser();

          // Get frame with sequence info
          const frameData = await getFrameWithSequence(frameId);

          if (!frameData || frameData.sequenceId !== sequenceId) {
            return json(
              {
                success: false,
                message: 'Frame not found in this sequence',
                timestamp: new Date().toISOString(),
              },
              { status: 404 }
            );
          }

          // Verify team access
          await requireTeamMemberAccess(user.id, frameData.sequence.teamId);

          // Enrich frame with fresh signed URLs
          const enrichedFrame =
            await frameService.enrichFrameWithSignedUrls(frameData);

          return json(
            {
              success: true,
              data: enrichedFrame,
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error(
            '[GET /api/sequences/$sequenceId/frames/$frameId] Error:',
            error
          );

          const handledError = handleApiError(error);
          return json(
            {
              success: false,
              message: 'Failed to get frame',
              error: handledError.toJSON(),
              timestamp: new Date().toISOString(),
            },
            { status: handledError.statusCode }
          );
        }
      },

      PATCH: async ({ request, params }) => {
        try {
          const { sequenceId, frameId } = params;

          // Validate ULIDs
          try {
            ulidSchema.parse(sequenceId);
            ulidSchema.parse(frameId);
          } catch {
            throw new ValidationError('Invalid sequence or frame ID format');
          }

          // Parse and validate request body
          const body = await request.json();
          const validated = updateFrameSchema.parse(body);

          // Authenticate user
          const user = await requireUser();

          // Get frame with sequence info to verify team access
          const frameData = await getFrameWithSequence(frameId);

          if (!frameData || frameData.sequenceId !== sequenceId) {
            return json(
              {
                success: false,
                message: 'Frame not found in this sequence',
                timestamp: new Date().toISOString(),
              },
              { status: 404 }
            );
          }

          // Verify team access
          await requireTeamMemberAccess(user.id, frameData.sequence.teamId);

          // Update frame
          const frame = await frameService.updateFrame({
            id: frameId,
            description: validated.description,
            orderIndex: validated.orderIndex,
            thumbnailUrl: validated.thumbnailUrl,
            videoUrl: validated.videoUrl,
            durationMs: validated.durationMs,
            metadata: validated.metadata,
          });

          return json(
            {
              success: true,
              data: frame,
              message: 'Frame updated successfully',
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error(
            '[PATCH /api/sequences/$sequenceId/frames/$frameId] Error:',
            error
          );

          if (error instanceof z.ZodError) {
            return json(
              {
                success: false,
                message: 'Invalid request data',
                errors: error.issues,
                timestamp: new Date().toISOString(),
              },
              { status: 400 }
            );
          }

          const handledError = handleApiError(error);
          return json(
            {
              success: false,
              message: 'Failed to update frame',
              error: handledError.toJSON(),
              timestamp: new Date().toISOString(),
            },
            { status: handledError.statusCode }
          );
        }
      },

      DELETE: async ({ params }) => {
        try {
          const { sequenceId, frameId } = params;

          // Validate ULIDs
          try {
            ulidSchema.parse(sequenceId);
            ulidSchema.parse(frameId);
          } catch {
            throw new ValidationError('Invalid sequence or frame ID format');
          }

          // Authenticate user
          const user = await requireUser();

          // Get frame with sequence info to verify team access
          const frameData = await getFrameWithSequence(frameId);

          if (!frameData || frameData.sequenceId !== sequenceId) {
            return json(
              {
                success: false,
                message: 'Frame not found in this sequence',
                timestamp: new Date().toISOString(),
              },
              { status: 404 }
            );
          }

          // Verify team access
          await requireTeamMemberAccess(user.id, frameData.sequence.teamId);

          // Delete frame
          await frameService.deleteFrame(frameId);

          return json(
            {
              success: true,
              message: 'Frame deleted successfully',
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error(
            '[DELETE /api/sequences/$sequenceId/frames/$frameId] Error:',
            error
          );

          const handledError = handleApiError(error);
          return json(
            {
              success: false,
              message: 'Failed to delete frame',
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
