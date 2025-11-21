/**
 * Sequence Frames API Endpoint
 * GET /api/sequences/[sequenceId]/frames - Get all frames for a sequence
 * POST /api/sequences/[sequenceId]/frames - Create frame(s) for a sequence
 * DELETE /api/sequences/[sequenceId]/frames - Delete all frames for a sequence
 *
 * Note: Frames created through the storyboard workflow contain structured FrameMetadata
 * with complete Scene data. See src/lib/ai/frame.schema.ts for the metadata structure.
 * Manual frame creation via this API is supported but should follow the same structure
 * when possible.
 */

import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getSequenceById } from '@/lib/db/helpers/queries';
import type { NewFrame } from '@/lib/db/schema';
import { handleApiError, ValidationError } from '@/lib/errors';
import {
  BulkFrameInput,
  bulkFrameSchema,
  SingleFrameInput,
  singleFrameSchema,
} from '@/lib/schemas/frame.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { frameService } from '@/lib/services/frame.service';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  try {
    const { sequenceId } = await params;

    // Validate ULID
    try {
      ulidSchema.parse(sequenceId);
    } catch {
      throw new ValidationError('Invalid sequence ID format');
    }

    // Authenticate user
    const user = await requireUser();

    // Verify sequence exists and get teamId
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
    // await requireTeamMemberAccess(user.id, sequence.teamId);

    // Get frames and enrich with fresh signed URLs
    const frames = await frameService.getFramesBySequence(sequenceId);
    const enrichedFrames =
      await frameService.enrichFramesWithSignedUrls(frames);

    return NextResponse.json(
      {
        success: true,
        data: enrichedFrames,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/sequences/[sequenceId]/frames] Error:', error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to get frames',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  try {
    const { sequenceId } = await params;

    // Validate ULID
    try {
      ulidSchema.parse(sequenceId);
    } catch {
      throw new ValidationError('Invalid sequence ID format');
    }

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

    // Parse request body
    const body: BulkFrameInput | SingleFrameInput = await request.json();

    // Determine if this is bulk or single creation
    const isBulk = 'frames' in body && Array.isArray(body.frames);

    if (isBulk) {
      // Bulk creation
      const validated = bulkFrameSchema.parse(body);

      const frameInserts: NewFrame[] = validated.frames.map((frame) => ({
        sequenceId: sequenceId,
        ...frame,
      }));

      const frames = await frameService.bulkInsertFrames(frameInserts);

      return NextResponse.json(
        {
          success: true,
          data: frames,
          message: `${frames.length} frames created successfully`,
          timestamp: new Date().toISOString(),
        },
        { status: 201 }
      );
    }

    // Single creation
    const validated = singleFrameSchema.parse(body);

    const frame = await frameService.createFrame({
      sequenceId,
      ...validated,
    });

    return NextResponse.json(
      {
        success: true,
        data: frame,
        message: 'Frame created successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/sequences/[sequenceId]/frames] Error:', error);

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
        message: 'Failed to create frame(s)',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  try {
    const { sequenceId } = await params;

    // Validate ULID
    try {
      ulidSchema.parse(sequenceId);
    } catch {
      throw new ValidationError('Invalid sequence ID format');
    }

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

    // Delete frames
    await frameService.deleteFramesBySequence(sequenceId);

    return NextResponse.json(
      {
        success: true,
        message: 'Frames deleted successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/sequences/[sequenceId]/frames] Error:', error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete frames',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
