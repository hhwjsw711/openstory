/**
 * Style API Endpoint
 * GET /api/styles/[styleId] - Get a single style
 * PATCH /api/styles/[styleId] - Update a style
 * DELETE /api/styles/[styleId] - Delete a style
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeamAdminAccess, requireUser } from '@/lib/auth/action-utils';
import { handleApiError, ValidationError } from '@/lib/errors';
import { updateStyleSchema } from '@/lib/schemas/style.schemas';
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const { styleId } = await params;

    // Validate UUID
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(styleId);
    } catch {
      throw new ValidationError('Invalid style ID format');
    }

    const supabase = createServerClient();
    const { data: style, error } = await supabase
      .from('styles')
      .select('*')
      .eq('id', styleId)
      .single();

    if (error) {
      throw new Error(`Failed to get style: ${error.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: style,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/styles/[styleId]] Error:', error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to get style',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const { styleId } = await params;

    // Validate UUID
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(styleId);
    } catch {
      throw new ValidationError('Invalid style ID format');
    }

    // Check authentication
    const user = await requireUser();

    // Get the current user's team to verify ownership
    const teamId = await getUserTeamId(user.id);
    if (!teamId) {
      throw new ValidationError('No team found for current user');
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = updateStyleSchema.parse(body);

    // Update style
    const supabase = createServerClient();
    const updateData: Record<
      string,
      Json | string | string[] | boolean | null | undefined
    > = {
      updated_at: new Date().toISOString(),
    };

    // Only include fields that were provided
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined)
      updateData.description = validated.description;
    if (validated.config !== undefined)
      updateData.config = validated.config as Json;
    if (validated.category !== undefined)
      updateData.category = validated.category;
    if (validated.tags !== undefined) updateData.tags = validated.tags;
    if (validated.is_public !== undefined)
      updateData.is_public = validated.is_public;
    if (validated.preview_url !== undefined)
      updateData.preview_url = validated.preview_url;

    const { data: style, error } = await supabase
      .from('styles')
      .update(updateData)
      .eq('id', styleId)
      .eq('team_id', teamId) // Ensure user can only update their team's styles
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update style: ${error.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: style,
        message: 'Style updated successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/styles/[styleId]] Error:', error);

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
        message: 'Failed to update style',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const { styleId } = await params;

    // Validate UUID
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(styleId);
    } catch {
      throw new ValidationError('Invalid style ID format');
    }

    // Check authentication
    const user = await requireUser();

    const supabase = createServerClient();

    // Get the style to verify team ownership
    const { data: style, error: fetchError } = await supabase
      .from('styles')
      .select('team_id')
      .eq('id', styleId)
      .single();

    if (fetchError || !style) {
      throw new ValidationError('Style not found');
    }

    // Check if user has admin/owner role for this team
    await requireTeamAdminAccess(user.id, style.team_id);

    // Delete the style
    const { error } = await supabase
      .from('styles')
      .delete()
      .eq('id', styleId)
      .eq('team_id', style.team_id);

    if (error) {
      throw new Error(`Failed to delete style: ${error.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Style deleted successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/styles/[styleId]] Error:', error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete style',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
