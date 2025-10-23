/**
 * Frame Generation Status API Endpoint
 * GET /api/sequences/[sequenceId]/frames/generation/status - Get frame generation status for a sequence
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { getSequenceFrames } from '@/lib/db/helpers/frames';
import { handleApiError, ValidationError } from '@/lib/errors';

export async function GET(
  _request: Request,
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

    // Authenticate user
    const user = await requireUser();

    // Verify sequence exists and get team_id + status
    const sequence = await getSequenceById(sequenceId);

    if (!sequence) {
      return NextResponse.json(
        {
          success: false,
          message: 'Sequence not found',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Verify team access
    await requireTeamMemberAccess(user.id, sequence.teamId);

    // If sequence is not processing, return null (no active generation)
    if (sequence.status !== 'processing') {
      return NextResponse.json(
        {
          success: true,
          data: null,
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    // Get frame progress
    const frames = await getSequenceFrames(sequenceId, {
      orderBy: 'orderIndex',
      ascending: true,
    });

    // Get expected frame count from metadata
    const metadata = sequence.metadata as Record<string, unknown> | null;
    const frameGenMetadata = metadata?.frameGeneration as
      | Record<string, unknown>
      | undefined;
    const expectedFrameCount =
      (frameGenMetadata?.expectedFrameCount as number) || 3;

    return NextResponse.json(
      {
        success: true,
        data: {
          status: sequence.status,
          framesProgress: {
            total: expectedFrameCount,
            completed: frames.filter((f) => f.thumbnailUrl).length,
            frames: frames.map((f) => ({
              id: f.id,
              orderIndex: f.orderIndex,
              thumbnailUrl: f.thumbnailUrl,
            })),
          },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[GET /api/sequences/[sequenceId]/frames/generation/status] Error:',
      error
    );

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to get generation status',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
