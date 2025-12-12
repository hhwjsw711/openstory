/**
 * Select Variant API Endpoint
 * POST /api/sequences/$sequenceId/frames/$frameId/select-variant - Select a variant panel
 *
 * Two-phase approach:
 * 1. Immediately crops the tile from the 3x3 grid and sets it as the thumbnail
 * 2. Triggers a background workflow to upscale the cropped tile
 */

import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getFrameWithSequence, updateFrame } from '@/lib/db/helpers/frames';
import { handleApiError, ValidationError } from '@/lib/errors';
import { cropTileFromGrid } from '@/lib/image/image-crop';
import { uploadImageBufferToStorage } from '@/lib/image/image-storage';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import type { UpscaleVariantWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { z } from 'zod';

const selectVariantSchema = z.object({
  variantIndex: z.number().int().min(0).max(8),
});

/**
 * Convert variant index (0-8) to row/column (1-3)
 * Grid layout:
 *   0 1 2
 *   3 4 5
 *   6 7 8
 */
function indexToRowCol(index: number): { row: number; col: number } {
  return {
    row: Math.floor(index / 3) + 1,
    col: (index % 3) + 1,
  };
}

export const Route = createFileRoute(
  '/api/sequences/$sequenceId/frames/$frameId/select-variant'
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
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
          const validatedBody = selectVariantSchema.parse(body);

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

          // Verify user has access to this frame
          await requireTeamMemberAccess(user.id, frameData.sequence.teamId);

          // Verify frame has variant image
          if (!frameData.variantImageUrl) {
            return json(
              {
                success: false,
                message: 'Frame has no variant image to select from',
                timestamp: new Date().toISOString(),
              },
              { status: 400 }
            );
          }

          // Convert index to row/column
          const { row, col } = indexToRowCol(validatedBody.variantIndex);

          // Phase 1: Crop the tile immediately using Sharp
          const cropResult = await cropTileFromGrid({
            gridImageUrl: frameData.variantImageUrl,
            row,
            col,
          });

          // Upload cropped tile to storage
          const uploadResult = await uploadImageBufferToStorage({
            imageBuffer: cropResult.buffer,
            teamId: frameData.sequence.teamId,
            sequenceId: frameData.sequenceId,
            frameId,
            contentType: 'image/png',
          });

          if (!uploadResult.url) {
            throw new Error('Failed to upload cropped image to storage');
          }

          // Update frame with cropped thumbnail and clear motion fields
          // Set thumbnailStatus to 'generating' - the upscale workflow will set it to 'completed'
          await updateFrame(frameId, {
            thumbnailUrl: uploadResult.url,
            thumbnailPath: uploadResult.path || null,
            thumbnailStatus: 'generating',
            thumbnailError: null,
            // Clear motion fields since the thumbnail changed
            videoUrl: null,
            videoPath: null,
            videoStatus: 'pending',
            videoWorkflowRunId: null,
            videoGeneratedAt: null,
            videoError: null,
          });

          // Phase 2: Trigger background upscale workflow
          const workflowInput: UpscaleVariantWorkflowInput = {
            userId: user.id,
            teamId: frameData.sequence.teamId,
            sequenceId: frameData.sequenceId,
            frameId,
            croppedTileUrl: uploadResult.url,
            croppedTilePath: uploadResult.path || '',
          };

          const workflowRunId = await triggerWorkflow(
            '/upscale-variant',
            workflowInput,
            {
              deduplicationId: `upscale-variant-${frameId}-${Date.now()}`,
            }
          );

          return json(
            {
              success: true,
              data: {
                frameId,
                thumbnailUrl: uploadResult.url,
                variantIndex: validatedBody.variantIndex,
                upscaleWorkflowRunId: workflowRunId,
                message: 'Variant selected. Upscaling in background.',
              },
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error(
            '[POST /api/sequences/$sequenceId/frames/$frameId/select-variant] Error:',
            error
          );

          if (error instanceof Error) {
            console.error('[select-variant] Error details:', {
              message: error.message,
              stack: error.stack,
              name: error.name,
            });
          }

          const handledError = handleApiError(error);
          return json(
            {
              success: false,
              message: handledError.message || 'Failed to select variant',
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
