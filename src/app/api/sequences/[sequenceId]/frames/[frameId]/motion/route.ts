/**
 * API endpoint for generating motion (video) from a frame's thumbnail
 * POST /api/sequences/[sequenceId]/frames/[frameId]/motion
 */

import { requireTeamMemberAccess } from '@/lib/auth/action-utils';
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
} from '@/lib/auth/api-utils';
import { getFrameWithSequence } from '@/lib/db/helpers/frames';
import { ValidationError } from '@/lib/errors';
import { generateMotionSchema } from '@/lib/schemas/frame.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import type { MotionWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sequenceId: string; frameId: string }> }
) {
  try {
    const { sequenceId, frameId } = await params;

    // Validate UUIDs

    try {
      ulidSchema.parse(sequenceId);
      ulidSchema.parse(frameId);
    } catch {
      throw new ValidationError('Invalid sequence or frame ID format');
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = generateMotionSchema.parse(body);

    // Authenticate user
    const authResult = await requireAuth(request);
    const user = authResult.user;

    // Get frame with sequence info
    const frameData = await getFrameWithSequence(frameId);

    if (!frameData || frameData.sequenceId !== sequenceId) {
      throw new ValidationError('Frame not found in this sequence');
    }

    // Verify user has access to this frame
    await requireTeamMemberAccess(user.id, frameData.sequence.teamId);

    // Check for thumbnail (either URL or path)
    const thumbnailUrl = frameData.thumbnailUrl;
    if (!thumbnailUrl) {
      return createErrorResponse(
        'Frame has no thumbnail to generate motion from',
        400
      );
    }

    // Trigger motion generation workflow
    const workflowInput: MotionWorkflowInput = {
      userId: user.id,
      teamId: frameData.sequence.teamId,
      frameId,
      sequenceId: frameData.sequenceId,
      imageUrl: thumbnailUrl, // Can be either path or URL
      prompt: frameData.description || '',
      model: validated.model,
      duration: validated.duration,
      fps: validated.fps,
      motionBucket: validated.motionBucket,
    };

    // Publish to QStash to trigger the workflow
    // Use deduplicationId to prevent duplicate motion workflows for the same frame
    const workflowRunId = await triggerWorkflow('/motion', workflowInput, {
      deduplicationId: `motion-${frameId}`,
    });

    return createSuccessResponse(
      {
        workflowRunId,
        frameId,
        sequenceId: frameData.sequenceId,
      },
      'Motion generation started successfully'
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(error.message, 400);
    }
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}
