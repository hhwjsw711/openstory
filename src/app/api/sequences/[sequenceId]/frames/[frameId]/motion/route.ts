/**
 * API endpoint for generating motion (video) from a frame's thumbnail
 * POST /api/sequences/[sequenceId]/frames/[frameId]/motion
 */

import {
  requireTeamMemberAccess,
  requireUser,
  validateMotionAccess,
} from '@/lib/auth/action-utils';
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/auth/api-utils';
import { getFrameWithSequence } from '@/lib/db/helpers/frames';
import { ValidationError } from '@/lib/errors';
import { generateMotionSchema } from '@/lib/schemas/frame.schemas';
import type { MotionWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { z } from 'zod';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sequenceId: string; frameId: string }> }
) {
  try {
    const { sequenceId, frameId } = await params;

    // Validate UUIDs
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(sequenceId);
      uuidSchema.parse(frameId);
    } catch {
      throw new ValidationError('Invalid sequence or frame ID format');
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = generateMotionSchema.parse(body);

    // Authenticate user (motion requires authenticated users)
    const user = await requireUser();
    validateMotionAccess(user);

    // Get frame with sequence info
    const frameData = await getFrameWithSequence(frameId);

    if (!frameData || frameData.sequenceId !== sequenceId) {
      throw new ValidationError('Frame not found in this sequence');
    }

    // Verify user has access to this frame
    await requireTeamMemberAccess(user.id, frameData.sequence.teamId);

    if (!frameData.thumbnailUrl) {
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
      thumbnailUrl: frameData.thumbnailUrl,
      prompt: frameData.description || undefined,
      model: validated.model,
      duration: validated.duration,
      fps: validated.fps,
      motionBucket: validated.motionBucket,
    };

    // Publish to QStash to trigger the workflow

    const workflowRunId = await triggerWorkflow('/motion', workflowInput);

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
