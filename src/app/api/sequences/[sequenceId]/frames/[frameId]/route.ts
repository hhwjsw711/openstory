/**
 * Frame API Endpoint
 * GET /api/sequences/[sequenceId]/frames/[frameId] - Get a single frame
 * PATCH /api/sequences/[sequenceId]/frames/[frameId] - Update a frame
 * DELETE /api/sequences/[sequenceId]/frames/[frameId] - Delete a frame
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getFrameWithSequence } from '@/lib/db/helpers/frames';
import { handleApiError, ValidationError } from '@/lib/errors';
import { updateFrameSchema } from '@/lib/schemas/frame.schemas';
import { frameService } from '@/lib/services/frame.service';

export async function GET(
  _request: Request,
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

    // Verify team access
    await requireTeamMemberAccess(user.id, frameData.sequence.teamId);

    return NextResponse.json(
      {
        success: true,
        data: frameData,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[GET /api/sequences/[sequenceId]/frames/[frameId]] Error:',
      error
    );

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to get frame',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

export async function PATCH(
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
    const validated = updateFrameSchema.parse(body);

    // Authenticate user
    const user = await requireUser();

    // Get frame with sequence info to verify team access
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

    // Verify team access
    await requireTeamMemberAccess(user.id, frameData.sequence.teamId);

    // Update frame
    const frame = await frameService.updateFrame({
      id: frameId,
      description: validated.description ?? undefined,
      orderIndex: validated.orderIndex,
      thumbnailUrl: validated.thumbnailUrl ?? undefined,
      videoUrl: validated.videoUrl ?? undefined,
      durationMs: validated.durationMs ?? undefined,
      metadata: validated.metadata as
        | Record<string, unknown>
        | null
        | undefined,
    });

    return NextResponse.json(
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
      '[PATCH /api/sequences/[sequenceId]/frames/[frameId]] Error:',
      error
    );

    if (error instanceof z.ZodError) {
      return NextResponse.json(
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
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update frame',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

export async function DELETE(
  _request: Request,
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

    // Authenticate user
    const user = await requireUser();

    // Get frame with sequence info to verify team access
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

    // Verify team access
    await requireTeamMemberAccess(user.id, frameData.sequence.teamId);

    // Delete frame
    await frameService.deleteFrame(frameId);

    return NextResponse.json(
      {
        success: true,
        message: 'Frame deleted successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[DELETE /api/sequences/[sequenceId]/frames/[frameId]] Error:',
      error
    );

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete frame',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
