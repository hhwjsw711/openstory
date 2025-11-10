/**
 * Sequences API Endpoint
 * POST /api/sequences - Create a new sequence
 * GET /api/sequences - List all sequences for the user's team
 */

import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { getUserDefaultTeam } from '@/lib/db/helpers/team-permissions';
import { handleApiError } from '@/lib/errors';
import {
  CreateSequenceInput,
  createSequenceSchema,
} from '@/lib/schemas/sequence.schemas';
import { sequenceService } from '@/lib/services/sequence.service';
import type { StoryboardWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await requireUser();

    // Parse and validate request body
    const body = await request.json();
    console.log('[POST /api/sequences] Request body:', body);
    const createSequenceInput: CreateSequenceInput =
      createSequenceSchema.parse(body);
    console.log('[POST /api/sequences] Validated data:', createSequenceInput);

    // Get teamId from request or fall back to user's default team
    let teamId = createSequenceInput.teamId;

    if (!teamId) {
      // Fallback to user's default team if not provided
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

      teamId = defaultTeam.teamId;
    }

    // Verify user has access to the specified team
    await requireTeamMemberAccess(user.id, teamId);

    // Create sequences in parallel for each selected model
    const { analysisModels } = createSequenceInput;
    console.log(
      '[POST /api/sequences] Creating sequences for models:',
      analysisModels
    );

    const sequences = await Promise.all(
      analysisModels.map(async (modelId) => {
        // Create sequence with model-specific config
        const createParams = {
          teamId,
          userId: user.id,
          title: createSequenceInput.title,
          script: createSequenceInput.script,
          styleId: createSequenceInput.styleId,
          aspectRatio: createSequenceInput.aspectRatio,
          analysisModel: modelId,
        };
        console.log(
          `[POST /api/sequences] Creating sequence for model ${modelId}:`,
          createParams
        );
        const sequence = await sequenceService.createSequence(createParams);
        console.log('[POST /api/sequences] Created sequence:', {
          id: sequence.id,
          analysisModel: sequence.analysisModel,
        });

        // Set status to 'processing' before triggering workflow
        await sequenceService.updateSequenceStatus(sequence.id, 'processing');

        // Generate frames asynchronously via workflow
        const workflowInput: StoryboardWorkflowInput = {
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
          await triggerWorkflow('/storyboard', workflowInput);
          console.log(
            `[POST /api/sequences] Workflow triggered for sequence ${sequence.id}`
          );
        } catch (workflowError) {
          // If workflow publish fails, mark sequence as failed
          console.error(
            `[POST /api/sequences] Failed to publish workflow for sequence ${sequence.id}:`,
            workflowError
          );
          await sequenceService.updateSequenceStatus(sequence.id, 'failed');
          throw workflowError;
        }

        // Revalidate paths for this sequence
        revalidatePath(`/sequences/${sequence.id}`);
        revalidatePath(`/sequences/${sequence.id}/script`);
        revalidatePath(`/sequences/${sequence.id}/scenes`);

        return sequence;
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: sequences,
        message: `Created ${sequences.length} sequence(s) successfully`,
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
