/**
 * Regenerate Frame API Endpoint
 * POST /api/sequences/[sequenceId]/frames/[frameId]/generate-image - Regenerate a single frame's thumbnail
 */

import { DEFAULT_IMAGE_MODEL, safeTextToImageModel } from '@/lib/ai/models';
import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import {
  aspectRatioToImageSize,
  type AspectRatio,
} from '@/lib/constants/aspect-ratios';
import { getFrameWithSequence } from '@/lib/db/helpers/frames';
import { handleApiError, ValidationError } from '@/lib/errors';
import { regenerateFrameSchema } from '@/lib/schemas/frame.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import type { ImageWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { NextResponse } from 'next/server';

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
    const validatedBody = regenerateFrameSchema.parse(body);

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

    // Determine which prompt to use (priority: provided > stored > AI-generated > description)
    const promptToUse =
      validatedBody.prompt ||
      frameData.imagePrompt ||
      (frameData.metadata as { prompts?: { visual?: { fullPrompt?: string } } })
        ?.prompts?.visual?.fullPrompt ||
      frameData.description;

    if (!promptToUse) {
      return NextResponse.json(
        {
          success: false,
          message: 'Frame has no prompt or description to regenerate from',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Determine which model to use (with runtime validation)
    const modelToUse =
      validatedBody.model ||
      safeTextToImageModel(frameData.imageModel, DEFAULT_IMAGE_MODEL);

    // Trigger image generation workflow with deduplication
    const workflowInput: ImageWorkflowInput = {
      userId: user.id,
      teamId: frameData.sequence.teamId,
      prompt: promptToUse,
      model: modelToUse,
      imageSize: aspectRatioToImageSize(
        frameData.sequence.aspectRatio as AspectRatio
      ),
      numImages: 1,
      frameId,
      sequenceId: frameData.sequenceId,
    };

    const workflowRunId = await triggerWorkflow('/image', workflowInput, {
      deduplicationId: `image-${frameId}`, // Prevent duplicate workflows
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          workflowRunId,
          frameId,
          message: 'Frame regeneration started',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[POST /api/sequences/[sequenceId]/frames/[frameId]/generate-image] Error:',
      error
    );

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to regenerate frame',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
