/**
 * Chapters VTT Endpoint
 * GET /api/sequences/[sequenceId]/chapters.vtt - Generate WebVTT chapters for sequence
 */

import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { handleApiError, ValidationError } from '@/lib/errors';
import { frameService } from '@/lib/services/frame.service';
import { generateChaptersVTT } from '@/lib/vtt/generate-chapters';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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

    // Verify user has access to the sequence's team
    const sequence = await getSequenceById(sequenceId);

    if (!sequence) {
      return new NextResponse('Sequence not found', { status: 404 });
    }

    await requireTeamMemberAccess(user.id, sequence.teamId);

    // Get frames ordered by orderIndex
    const frames = await frameService.getFramesBySequence(sequenceId);

    if (frames.length === 0) {
      return new NextResponse('No frames found for sequence', { status: 404 });
    }

    // Generate WebVTT chapters
    const vtt = generateChaptersVTT(frames);

    // Return as VTT format
    return new NextResponse(vtt, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/sequences/[sequenceId]/chapters.vtt] Error:',
      error
    );
    const handledError = handleApiError(error);

    return new NextResponse(handledError.message, {
      status: handledError.statusCode,
    });
  }
}
