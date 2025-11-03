/**
 * Sequence API Endpoint
 * GET /api/sequences/[sequenceId] - Get a sequence by ID
 * PATCH /api/sequences/[sequenceId] - Update a sequence
 * DELETE /api/sequences/[sequenceId] - Delete a sequence
 */

import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { handleApiError, ValidationError } from '@/lib/errors';
import { updateSequenceSchema } from '@/lib/schemas/sequence.schemas';
import { sequenceService } from '@/lib/services/sequence.service';
import type { FrameGenerationWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { revalidatePath } from 'next/cache';
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
    const seq = await getSequenceById(sequenceId);

    if (seq) {
      await requireTeamMemberAccess(user.id, seq.teamId);
    }

    const sequence = await sequenceService.getSequence(sequenceId, true);

    return NextResponse.json(
      {
        success: true,
        data: sequence,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/sequences/[sequenceId]] Error:', error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to get sequence',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

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

    // Authenticate user
    const user = await requireUser();

    // Parse and validate request body
    const body = await request.json();
    const sequenceDetailsToUpdate = updateSequenceSchema.parse(body);

    // Verify sequence exists and get team info
    const existingSeq = await getSequenceById(sequenceId);

    if (!existingSeq) {
      return NextResponse.json(
        {
          success: false,
          message: 'Sequence not found',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }
    // Verify user has access to this sequence's team
    await requireTeamMemberAccess(user.id, existingSeq.teamId);

    // Check if we need to regenerate the storyboard
    const needToRegenerateStoryboard = true;

    // Update sequence
    const sequence = await sequenceService.updateSequence({
      id: sequenceId,
      userId: user.id,
      ...sequenceDetailsToUpdate,
      metadata: sequenceDetailsToUpdate.metadata ?? undefined,
      status: needToRegenerateStoryboard ? 'processing' : undefined,
    });

    // If script or style changed, regenerate frames
    if (needToRegenerateStoryboard) {
      if (existingSeq.status === 'processing') {
        // We need to cancel the current processing workflow
        // await cancelWorkflow(existingSeq.workflowRunId);
      }

      // Trigger frame generation workflow
      const workflowInput: FrameGenerationWorkflowInput = {
        userId: user.id,
        teamId: existingSeq.teamId,
        sequenceId,
        options: {
          framesPerScene: 3,
          generateThumbnails: true,
          generateDescriptions: true,
          aiProvider: 'openrouter',
          regenerateAll: true,
        },
      };

      // Publish to QStash to trigger the workflow
      await triggerWorkflow('/storyboard', workflowInput);
    }

    // Revalidate paths
    revalidatePath(`/sequences/${sequenceId}`);
    revalidatePath(`/sequences/${sequenceId}/script`);
    revalidatePath(`/sequences/${sequenceId}/storyboard`);

    return NextResponse.json(
      {
        success: true,
        data: sequence,
        message: 'Sequence updated successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/sequences/[sequenceId]] Error:', error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update sequence',
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

    // Validate UUID
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(sequenceId);
    } catch {
      throw new ValidationError('Invalid sequence ID format');
    }

    // Authenticate user
    const user = await requireUser();

    // Get the sequence to verify team ownership
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

    // Require admin access to delete
    await requireTeamMemberAccess(user.id, sequence.teamId, 'admin');

    // Delete the sequence (frames will be cascade deleted)
    await sequenceService.deleteSequence(sequenceId);

    // Revalidate sequence pages
    revalidatePath('/sequences');
    revalidatePath(`/sequences/${sequenceId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Sequence deleted successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/sequences/[sequenceId]] Error:', error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete sequence',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
