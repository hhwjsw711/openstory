/**
 * Regenerate Motion API Endpoint
 * POST /api/sequences/[sequenceId]/frames/[frameId]/regenerate-motion - Regenerate a single frame's motion video
 */

import { DEFAULT_VIDEO_MODEL, type ImageToVideoModel } from '@/lib/ai/models';
import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getFrameWithSequence } from '@/lib/db/helpers/frames';
import { handleApiError, ValidationError } from '@/lib/errors';
import { regenerateMotionSchema } from '@/lib/schemas/frame.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import type { MotionWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sequenceId: string; frameId: string }> }
) {
  try {
    const { sequenceId, frameId } = await params;

    // Validate ULIDs
    try {
      ulidSchema.parse(sequenceId);
      ulidSchema.parse(frameId);
    } catch {
      throw new ValidationError('Invalid sequence or frame ID format');
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedBody = regenerateMotionSchema.parse(body);

    // Authenticate user
    const user = await requireUser();

    // Get frame with sequence info
    const frameData = await getFrameWithSequence(frameId);

    if (!frameData || frameData.sequenceId !== sequenceId) {
      return NextResponse.json(
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

    // Check for thumbnail (required for motion generation)
    const thumbnailPath = frameData.thumbnailPath;
    if (!thumbnailPath) {
      return NextResponse.json(
        {
          success: false,
          message: 'Frame has no thumbnail to generate motion from',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Determine which prompt to use (priority: provided > stored > AI-generated > description)
    const promptToUse =
      validatedBody.prompt ||
      frameData.motionPrompt ||
      (frameData.metadata as { prompts?: { motion?: { fullPrompt?: string } } })
        ?.prompts?.motion?.fullPrompt ||
      frameData.description ||
      '';

    // Determine which model to use (priority: provided > frame's stored > sequence default > global default)
    const modelToUse =
      validatedBody.model ||
      (frameData.motionModel as ImageToVideoModel | null) ||
      (frameData.sequence.videoModel as ImageToVideoModel) ||
      DEFAULT_VIDEO_MODEL;

    // Trigger motion generation workflow with deduplication
    const workflowInput: MotionWorkflowInput = {
      userId: user.id,
      teamId: frameData.sequence.teamId,
      frameId,
      sequenceId: frameData.sequenceId,
      thumbnailPath,
      prompt: promptToUse,
      model: modelToUse,
      duration: validatedBody.duration,
      fps: validatedBody.fps,
      motionBucket: validatedBody.motionBucket,
    };

    const workflowRunId = await triggerWorkflow('/motion', workflowInput, {
      deduplicationId: `motion-${frameId}`, // Prevent duplicate workflows
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          workflowRunId,
          frameId,
          message: 'Motion regeneration started',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[POST /api/sequences/[sequenceId]/frames/[frameId]/regenerate-motion] Error:',
      error
    );

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to regenerate motion',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
