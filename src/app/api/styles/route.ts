/**
 * Styles API Endpoint
 * POST /api/styles - Create a new style
 * GET /api/styles - List all styles for the user
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/action-utils';
import { handleApiError, ValidationError } from '@/lib/errors';
import { createStyleSchema } from '@/lib/schemas/style.schemas';
import { createServerClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

/**
 * Get the current user's team ID
 */
async function getUserTeamId(userId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data: teamMembership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .single();

  return teamMembership?.team_id || null;
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const user = await requireUser();

    // Get the current user's team
    const teamId = await getUserTeamId(user.id);
    if (!teamId) {
      throw new ValidationError('No team found for current user');
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = createStyleSchema.parse(body);

    // Create style
    const supabase = createServerClient();
    const { data: style, error } = await supabase
      .from('styles')
      .insert({
        team_id: teamId,
        name: validated.name,
        description: validated.description,
        config: validated.config as Json,
        category: validated.category,
        tags: validated.tags || [],
        is_public: validated.is_public,
        preview_url: validated.preview_url,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create style: ${error.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: style,
        message: 'Style created successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/styles] Error:', error);

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
        message: 'Failed to create style',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

export async function GET() {
  try {
    // Check authentication
    const user = await requireUser();

    // Get the current user's team
    const teamId = await getUserTeamId(user.id);

    const supabase = createServerClient();

    if (!teamId) {
      // If no team, just return public styles
      const { data: styles, error } = await supabase
        .from('styles')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to list styles: ${error.message}`);
      }

      return NextResponse.json(
        {
          success: true,
          data: styles || [],
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    // Get team styles and public styles
    const { data: styles, error } = await supabase
      .from('styles')
      .select('*')
      .or(`team_id.eq.${teamId},is_public.eq.true`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list styles: ${error.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: styles || [],
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/styles] Error:', error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to list styles',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
