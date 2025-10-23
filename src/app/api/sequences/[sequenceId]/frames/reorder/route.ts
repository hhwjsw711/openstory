/**
 * Reorder Frames API Endpoint
 * PATCH /api/sequences/[sequenceId]/frames/reorder - Reorder frames in a sequence
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { handleApiError, ValidationError } from '@/lib/errors';
import { frameService } from '@/lib/services/frame.service';

const frameOrderSchema = z.object({
  id: z.string().uuid(),
  order_index: z.number().int(),
});

const reorderSchema = z.object({
  frameOrders: z.array(frameOrderSchema).min(1),
});

export async function PATCH(
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

    // Parse and validate request body
    const body = await request.json();
    const validated = reorderSchema.parse(body);

    // Authenticate user
    const user = await requireUser();

    // Verify sequence exists and get team_id
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

    // Reorder frames
    await frameService.reorderFrames(sequenceId, validated.frameOrders);

    return NextResponse.json(
      {
        success: true,
        message: 'Frames reordered successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[PATCH /api/sequences/[sequenceId]/frames/reorder] Error:',
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
        message: 'Failed to reorder frames',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
