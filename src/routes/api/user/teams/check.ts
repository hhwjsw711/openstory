/**
 * Check Team Access API Endpoint
 * POST /api/user/teams/check - Check if user has access to a team
 */

import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getCurrentUserFn } from '@/lib/auth/server';
import { handleApiError } from '@/lib/errors';
import { canAccessTeam } from '@/lib/db/helpers';
import { ulidSchema } from '@/lib/schemas/id.schemas';

const checkAccessSchema = z.object({
  teamId: ulidSchema,
});

export const Route = createFileRoute('/api/user/teams/check')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await getCurrentUserFn();

          if (!user) {
            return Response.json(
              {
                success: false,
                message: 'Authentication required',
                hasAccess: false,
                timestamp: new Date().toISOString(),
              },
              { status: 401 }
            );
          }

          // Parse and validate request body
          const body = await request.json();
          const validated = checkAccessSchema.parse(body);

          const hasAccess = await canAccessTeam(user.id, validated.teamId);

          return Response.json(
            {
              success: true,
              data: {
                hasAccess,
              },
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error('[POST /api/user/teams/check] Error:', error);

          if (error instanceof z.ZodError) {
            return Response.json(
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
          return Response.json(
            {
              success: false,
              message: 'Failed to check team access',
              error: handledError.toJSON(),
              timestamp: new Date().toISOString(),
            },
            { status: handledError.statusCode }
          );
        }
      },
    },
  },
});
