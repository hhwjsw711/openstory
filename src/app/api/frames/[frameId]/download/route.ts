/**
 * Frame Download API Endpoint
 * GET /api/frames/[frameId]/download - Get a signed download URL for a frame's video
 */

import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { db } from '@/lib/db/client';
import { frames, sequences } from '@/lib/db/schema';
import { handleApiError, ValidationError } from '@/lib/errors';
import { getVideoDownloadUrl } from '@/lib/services/video-storage.service';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ulidSchema } from '@/lib/schemas/id.schemas';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ frameId: string }> }
) {
  try {
    const { frameId } = await params;

    // Validate ULID

    try {
      ulidSchema.parse(frameId);
    } catch {
      throw new ValidationError('Invalid frame ID format');
    }

    // Authenticate user
    const user = await requireUser();

    // Get frame with sequence info to verify access and extract video path
    const [frame] = await db
      .select({
        id: frames.id,
        videoUrl: frames.videoUrl,
        videoPath: frames.videoPath,
        sequenceId: frames.sequenceId,
        metadata: frames.metadata,
        teamId: sequences.teamId,
        sequenceTitle: sequences.title,
      })
      .from(frames)
      .innerJoin(sequences, eq(frames.sequenceId, sequences.id))
      .where(eq(frames.id, frameId));

    if (!frame) {
      return NextResponse.json(
        {
          success: false,
          message: 'Frame not found',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Verify user has access to the frame's team
    await requireTeamMemberAccess(user.id, frame.teamId);

    // Check if frame has a video (use videoPath if available, fall back to videoUrl check)
    if (!frame.videoPath && !frame.videoUrl) {
      return NextResponse.json(
        {
          success: false,
          message: 'Frame does not have a video',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Use stored videoPath if available, otherwise construct it for backward compatibility
    const videoPath =
      frame.videoPath ||
      `teams/${frame.teamId}/sequences/${frame.sequenceId}/frames/${frame.id}/motion.mp4`;

    // Generate filename from sequence title and scene title
    const sanitizeForFilename = (text: string) =>
      text
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .substring(0, 50); // Limit each part to 50 chars

    const sanitizedSequenceTitle = frame.sequenceTitle
      ? sanitizeForFilename(frame.sequenceTitle)
      : '';

    const sceneTitle = (frame.metadata as { metadata?: { title?: string } })
      ?.metadata?.title;
    const sanitizedSceneTitle = sceneTitle
      ? sanitizeForFilename(sceneTitle)
      : '';

    // Construct filename: sequenceTitle_sceneTitle_velro.mp4
    const downloadFilename =
      sanitizedSequenceTitle && sanitizedSceneTitle
        ? `${sanitizedSequenceTitle}_${sanitizedSceneTitle}_velro.mp4`
        : sanitizedSequenceTitle
          ? `${sanitizedSequenceTitle}_scene-${frame.id}_velro.mp4`
          : sanitizedSceneTitle
            ? `${sanitizedSceneTitle}_velro.mp4`
            : `scene-${frame.id}_velro.mp4`;

    // Generate signed download URL with Content-Disposition
    const url = await getVideoDownloadUrl(videoPath, downloadFilename, 3600);

    return NextResponse.json(
      {
        success: true,
        data: {
          downloadUrl: url,
          filename: downloadFilename,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/frames/[frameId]/download] Error:', error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to generate download URL',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
