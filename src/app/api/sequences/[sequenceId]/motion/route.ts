/**
 * API endpoint for generating motion for all frames in a sequence
 * POST /api/sequences/[sequenceId]/motion
 */

import { IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuthenticatedUserForMotion,
} from '@/lib/auth/api-utils';
import { getSequenceFrames } from '@/lib/db/helpers/frames';
import { getUserDefaultTeam } from '@/lib/db/helpers/team-permissions';
import { ValidationError } from '@/lib/errors';
import type { MotionWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { z } from 'zod';

// Request body schema
const requestSchema = z.object({
  model: z
    .enum(
      Object.keys(IMAGE_TO_VIDEO_MODELS) as [keyof typeof IMAGE_TO_VIDEO_MODELS]
    )
    .optional(),
  duration: z.number().min(1).max(10).optional(),
  fps: z.number().min(7).max(30).optional(),
  motionBucket: z.number().min(1).max(255).optional(),
  frameIds: z.array(z.string().uuid()).optional(), // Optional: specific frames to generate
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  try {
    const { sequenceId } = await params;

    // Validate UUID
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(sequenceId);
    } catch {
      throw new ValidationError('Invalid sequence ID format');
    }

    // Check authentication and get user
    const authResult = await requireAuthenticatedUserForMotion(request);
    const user = authResult.user;

    // Get user's team using Drizzle helper
    const membership = await getUserDefaultTeam(user.id);

    if (!membership) {
      return createErrorResponse('No team found for user', 404);
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    // Get frames for the sequence using Drizzle helper
    let allFrames = await getSequenceFrames(sequenceId);

    // Filter by specific frame IDs if provided
    if (validatedData.frameIds && validatedData.frameIds.length > 0) {
      allFrames = allFrames.filter((f) =>
        validatedData.frameIds!.includes(f.id)
      );
    }

    if (allFrames.length === 0) {
      return createErrorResponse('No frames found for sequence', 404);
    }

    // Filter frames that have thumbnails
    const framesWithThumbnails = allFrames.filter((f) => f.thumbnailUrl);

    if (framesWithThumbnails.length === 0) {
      return createErrorResponse('No frames with thumbnails found', 400);
    }

    // Generate motion for each frame using workflows
    const workflows = [];
    const errors = [];

    for (const frame of framesWithThumbnails) {
      try {
        // TypeScript guard - we already filtered for frames with thumbnails
        if (!frame.thumbnailUrl) continue;

        // Use description or empty string as fallback
        const prompt = frame.description || '';

        // Trigger motion workflow
        const workflowInput: MotionWorkflowInput = {
          userId: user.id,
          teamId: membership.teamId,
          frameId: frame.id,
          sequenceId,
          thumbnailUrl: frame.thumbnailUrl,
          prompt,
          model: validatedData.model,
          duration: validatedData.duration,
          fps: validatedData.fps,
          motionBucket: validatedData.motionBucket,
        };

        // Publish to QStash to trigger the workflow
        const workflowRunId = await triggerWorkflow('/motion', workflowInput);

        workflows.push({
          frameId: frame.id,
          workflowRunId,
          orderIndex: frame.orderIndex,
        });
      } catch (error) {
        errors.push({
          frameId: frame.id,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to start motion generation',
        });
      }
    }

    return createSuccessResponse(
      {
        sequenceId,
        totalFrames: allFrames.length,
        framesWithThumbnails: framesWithThumbnails.length,
        workflowsStarted: workflows.length,
        workflows,
        errors: errors.length > 0 ? errors : undefined,
      },
      `Motion generation started for ${workflows.length} frames`
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
