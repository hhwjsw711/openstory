/**
 * Generate Frames API Endpoint
 * POST /api/sequences/[sequenceId]/frames/generate - Generate frames for a sequence
 */

import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { handleApiError, ValidationError } from '@/lib/errors';
import { sequenceService } from '@/lib/services/sequence.service';
import type { StoryboardWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function POST(
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

    // Verify sequence exists and get team info
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

    // Verify user has access to this sequence
    await requireTeamMemberAccess(user.id, sequence.teamId);

    // Check if sequence is already processing
    if (sequence.status === 'processing') {
      console.log('[generateFrames] Sequence already processing', {
        sequenceId,
      });
      return NextResponse.json(
        {
          success: true,
          message: 'Frame generation already in progress',
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    // Update sequence status to processing
    await sequenceService.updateSequenceStatus(sequenceId, 'processing');

    // Trigger frame generation workflow
    const workflowInput: StoryboardWorkflowInput = {
      userId: user.id,
      teamId: sequence.teamId,
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
    const workflowRunId = await triggerWorkflow('/storyboard', workflowInput);

    console.log('[generateFrames] Frame generation workflow triggered', {
      sequenceId,
      workflowRunId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          workflowRunId,
          frames: [],
        },
        message: 'Frame generation started successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[POST /api/sequences/[sequenceId]/frames/generate] Error:',
      error
    );
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to generate frames',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
