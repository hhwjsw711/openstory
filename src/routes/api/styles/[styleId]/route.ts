/**
 * Style API Endpoint
 * GET /api/styles/[styleId] - Get a single style
 * PATCH /api/styles/[styleId] - Update a style
 * DELETE /api/styles/[styleId] - Delete a style
 */

import { getDb } from '#db-client';
import { requireUser } from '@/lib/auth/action-utils';
import {
  getStyleById,
  getUserDefaultTeam,
  requireTeamManagement,
} from '@/lib/db/helpers';
import { styles } from '@/lib/db/schema';
import { handleApiError, ValidationError } from '@/lib/errors';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { updateStyleSchema } from '@/lib/schemas/style.schemas';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const { styleId } = await params;

    // Validate ULID

    try {
      ulidSchema.parse(styleId);
    } catch {
      throw new ValidationError('Invalid style ID format');
    }

    const style = await getStyleById(styleId);

    if (!style) {
      throw new ValidationError('Style not found');
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

    // Validate ULID

    try {
      ulidSchema.parse(styleId);
    } catch {
      throw new ValidationError('Invalid style ID format');
    }

    // Check authentication
    const user = await requireUser();

    // Get the current user's team to verify ownership
    const teamMembership = await getUserDefaultTeam(user.id);
    if (!teamMembership) {
      throw new ValidationError('No team found for current user');
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = updateStyleSchema.parse(body);

    // Update style with Drizzle
    const result = await getDb()
      .update(styles)
      .set(validated)
      .where(
        and(eq(styles.id, styleId), eq(styles.teamId, teamMembership.teamId))
      )
      .returning();
    const style = Array.isArray(result) ? result[0] : undefined;

    if (!style) {
      throw new ValidationError(
        'Style not found or you do not have permission to update it'
      );
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

    // Validate ULID

    try {
      ulidSchema.parse(styleId);
    } catch {
      throw new ValidationError('Invalid style ID format');
    }

    // Check authentication
    const user = await requireUser();

    // Get the style to verify team ownership
    const style = await getStyleById(styleId);

    if (!style) {
      throw new ValidationError('Style not found');
    }

    // Check if user has admin/owner role for this team
    await requireTeamManagement(user.id, style.teamId);

    // Delete the style with Drizzle
    await getDb()
      .delete(styles)
      .where(and(eq(styles.id, styleId), eq(styles.teamId, style.teamId)));

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
