/**
 * Generate Variant Image API Endpoint
 * POST /api/sequences/[sequenceId]/frames/[frameId]/variants - Generate variant image for a frame
 */

import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import {
  aspectRatioToImageSize,
  type AspectRatio,
  ImageSize,
} from '@/lib/constants/aspect-ratios';
import { getFrameWithSequence } from '@/lib/db/helpers/frames';
import { handleApiError, ValidationError } from '@/lib/errors';
import { generateVariantSchema } from '@/lib/schemas/frame.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import type { VariantWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { TextToImageModel } from '@/lib/ai/models';

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

    // Parse and validate request body (all fields optional)
    let validatedBody: {
      model?: TextToImageModel;
      imageSize?: ImageSize;
      numImages?: number;
      seed?: number;
    } = {};

    // Check if request has a body
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        const body = await request.json();
        validatedBody = generateVariantSchema.parse(body);
      } catch (error) {
        // If body exists but is invalid, return validation error
        if (error instanceof ZodError) {
          throw new ValidationError('Invalid request body format');
        }
        // If JSON parsing fails, treat as invalid
        throw new ValidationError('Invalid JSON in request body');
      }
    }

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

    // Verify frame has thumbnailUrl (required for variant generation)
    if (!frameData.thumbnailUrl) {
      return NextResponse.json(
        {
          success: false,
          message: 'Frame must have a thumbnail image to generate variants',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Build workflow input
    const workflowInput: VariantWorkflowInput = {
      userId: user.id,
      teamId: frameData.sequence.teamId,
      sequenceId: frameData.sequenceId,
      frameId,
      thumbnailUrl: frameData.thumbnailUrl,
      model: validatedBody.model,
      imageSize:
        validatedBody.imageSize ||
        aspectRatioToImageSize(frameData.sequence.aspectRatio as AspectRatio),
      numImages: validatedBody.numImages ?? 1,
      seed: validatedBody.seed,
    };

    // Trigger variant image generation workflow with deduplication
    const workflowRunId = await triggerWorkflow(
      '/variant-image',
      workflowInput,
      {
        deduplicationId: `variant-${frameId}`, // Prevent duplicate workflows
      }
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          workflowRunId,
          frameId,
          message: 'Variant image generation started',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[POST /api/sequences/[sequenceId]/frames/[frameId]/variants] Error:',
      error
    );

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to generate variant image',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
