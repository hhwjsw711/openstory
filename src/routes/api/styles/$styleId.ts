/**
 * Style API Endpoint (TanStack Start)
 * GET /api/styles/:styleId - Get a single style
 * PATCH /api/styles/:styleId - Update a style
 * DELETE /api/styles/:styleId - Delete a style
 */

import { getDb } from '#db-client';
import { errorResponse, json, successResponse } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/api-utils';
import {
  getStyleById,
  getUserDefaultTeam,
  requireTeamManagement,
} from '@/lib/db/helpers';
import { styles } from '@/lib/db/schema';
import { handleApiError, ValidationError } from '@/lib/errors';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { updateStyleSchema } from '@/lib/schemas/style.schemas';
import { createFileRoute } from '@tanstack/react-router';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

export const Route = createFileRoute('/api/styles/$styleId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { styleId } = params;

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

          return successResponse(style);
        } catch (error) {
          console.error('[GET /api/styles/$styleId] Error:', error);

          const handledError = handleApiError(error);
          return errorResponse('Failed to get style', handledError.statusCode, {
            error: handledError.toJSON(),
          });
        }
      },

      PATCH: async ({ request, params }) => {
        try {
          const { styleId } = params;

          // Validate ULID
          try {
            ulidSchema.parse(styleId);
          } catch {
            throw new ValidationError('Invalid style ID format');
          }

          // Check authentication
          const authResult = await requireAuth(request);
          const user = authResult.user;

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
              and(
                eq(styles.id, styleId),
                eq(styles.teamId, teamMembership.teamId)
              )
            )
            .returning();
          const style = Array.isArray(result) ? result[0] : undefined;

          if (!style) {
            throw new ValidationError(
              'Style not found or you do not have permission to update it'
            );
          }

          return successResponse(style, 'Style updated successfully');
        } catch (error) {
          console.error('[PATCH /api/styles/$styleId] Error:', error);

          if (error instanceof z.ZodError) {
            return json(
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
          return errorResponse(
            'Failed to update style',
            handledError.statusCode,
            { error: handledError.toJSON() }
          );
        }
      },

      DELETE: async ({ request, params }) => {
        try {
          const { styleId } = params;

          // Validate ULID
          try {
            ulidSchema.parse(styleId);
          } catch {
            throw new ValidationError('Invalid style ID format');
          }

          // Check authentication
          const authResult = await requireAuth(request);
          const user = authResult.user;

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
            .where(
              and(eq(styles.id, styleId), eq(styles.teamId, style.teamId))
            );

          return successResponse(undefined, 'Style deleted successfully', 200);
        } catch (error) {
          console.error('[DELETE /api/styles/$styleId] Error:', error);

          const handledError = handleApiError(error);
          return errorResponse(
            'Failed to delete style',
            handledError.statusCode,
            { error: handledError.toJSON() }
          );
        }
      },
    },
  },
});
