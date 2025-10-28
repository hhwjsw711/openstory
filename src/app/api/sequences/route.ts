/**
 * Sequences API Endpoint
 * POST /api/sequences - Create a new sequence
 * GET /api/sequences - List all sequences for the user's team
 */

import { requireUser } from '@/lib/auth/action-utils';
import { getUserDefaultTeam } from '@/lib/db/helpers/team-permissions';
import { handleApiError } from '@/lib/errors';
import { createSequenceSchema } from '@/lib/schemas/sequence.schemas';
import { sequenceService } from '@/lib/services/sequence.service';
import type { FrameGenerationWorkflowInput } from '@/lib/workflow';
import { publishWorkflow } from '@/lib/workflow';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await requireUser();

    // Parse and validate request body
    const body = await request.json();
    console.log('[POST /api/sequences] Request body:', body);
    const validated = createSequenceSchema.parse(body);
    console.log('[POST /api/sequences] Validated data:', validated);

    // Get user's team using Drizzle helper
    const defaultTeam = await getUserDefaultTeam(user.id);

    if (!defaultTeam) {
      return NextResponse.json(
        {
          success: false,
          message:
            'No team found for user. Please refresh the page to initialize your account.',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const teamId = defaultTeam.teamId;

    // Create sequence
    const createParams = {
      teamId,
      userId: user.id,
      name: validated.title,
      script: validated.script,
      styleId: validated.styleId || undefined,
    };
    console.log(
      '[POST /api/sequences] Creating sequence with params:',
      createParams
    );
    const sequence = await sequenceService.createSequence(createParams);
    console.log('[POST /api/sequences] Created sequence:', {
      id: sequence.id,
      styleId: sequence.styleId,
    });

    // Set status to 'processing' before triggering workflow for immediate UI feedback
    await sequenceService.updateSequenceStatus(sequence.id, 'processing');
    console.log('[POST /api/sequences] Set sequence status to processing');

    // Generate frames asynchronously via workflow
    const workflowInput: FrameGenerationWorkflowInput = {
      userId: user.id,
      teamId,
      sequenceId: sequence.id,
      options: {
        framesPerScene: 3,
        generateThumbnails: true,
        generateDescriptions: true,
        aiProvider: 'openrouter',
        regenerateAll: true,
      },
    };

    try {
      await publishWorkflow('/storyboard', workflowInput);
      console.log('[POST /api/sequences] Workflow triggered successfully');
    } catch (workflowError) {
      // If workflow publish fails, mark sequence as failed
      console.error(
        '[POST /api/sequences] Failed to publish workflow:',
        workflowError
      );
      await sequenceService.updateSequenceStatus(sequence.id, 'failed');
      throw workflowError;
    }

    // Revalidate paths
    revalidatePath(`/sequences/${sequence.id}`);
    revalidatePath(`/sequences/${sequence.id}/script`);
    revalidatePath(`/sequences/${sequence.id}/storyboard`);

    return NextResponse.json(
      {
        success: true,
        data: sequence,
        message: 'Sequence created successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/sequences] Error:', error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create sequence',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

export async function GET() {
  try {
    // Authenticate user
    const user = await requireUser();

    // Get user's default team using Drizzle helper
    const defaultTeam = await getUserDefaultTeam(user.id);

    if (!defaultTeam) {
      // No team membership yet, return empty array
      return NextResponse.json(
        {
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    const sequences = await sequenceService.getSequencesByTeam(
      defaultTeam.teamId
    );

    return NextResponse.json(
      {
        success: true,
        data: sequences,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/sequences] Error:', error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to list sequences',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
