/**
 * Styles API Endpoint (TanStack Start)
 * POST /api/styles - Create a new style
 * GET /api/styles - List all styles for the user
 */

import { getDb } from '#db-client';
import { errorResponse, json, successResponse } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/api-utils';
import {
  getPublicStyles,
  getTeamAndPublicStyles,
  getUserDefaultTeam,
} from '@/lib/db/helpers';
import { styles } from '@/lib/db/schema';
import { handleApiError, ValidationError } from '@/lib/errors';
import { createStyleSchema } from '@/lib/schemas/style.schemas';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/api/styles')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Check authentication
          const authResult = await requireAuth(request);
          const user = authResult.user;

          // Get the current user's team
          const teamMembership = await getUserDefaultTeam(user.id);
          if (!teamMembership) {
            throw new ValidationError('No team found for current user');
          }

          // Parse and validate request body
          const body = await request.json();
          const validated = createStyleSchema.parse(body);

          // Create style with Drizzle
          const result = await getDb()
            .insert(styles)
            .values({
              teamId: teamMembership.teamId,
              name: validated.name,
              description: validated.description,
              config: validated.config,
              category: validated.category,
              tags: validated.tags || [],
              isPublic: validated.isPublic,
              previewUrl: validated.previewUrl,
              createdBy: user.id,
            })
            .returning();
          // Handle ambiguous return type due to self-referencing styles table
          const style = result[0];

          return json(
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
            'Failed to create style',
            handledError.statusCode,
            { error: handledError.toJSON() }
          );
        }
      },

      GET: async ({ request }) => {
        try {
          // Check authentication
          const authResult = await requireAuth(request);
          const user = authResult.user;

          // Get the current user's team
          const teamMembership = await getUserDefaultTeam(user.id);

          let stylesList;

          if (!teamMembership) {
            // If no team, just return public styles
            stylesList = await getPublicStyles();
          } else {
            // Get team styles and public styles
            stylesList = await getTeamAndPublicStyles(teamMembership.teamId);
          }

          return successResponse(stylesList);
        } catch (error) {
          console.error('[GET /api/styles] Error:', error);

          const handledError = handleApiError(error);
          return errorResponse(
            'Failed to list styles',
            handledError.statusCode,
            { error: handledError.toJSON() }
          );
        }
      },
    },
  },
});
