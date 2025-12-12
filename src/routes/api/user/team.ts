/**
 * User Team API Endpoint
 * GET /api/user/team - Get user's team
 */

import { createFileRoute } from '@tanstack/react-router';
import { getUser } from '@/lib/auth/server';
import { handleApiError } from '@/lib/errors';
import { getUserDefaultTeam } from '@/lib/db/helpers';

export const Route = createFileRoute('/api/user/team')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const user = await getUser();

          if (!user) {
            return Response.json(
              {
                success: false,
                message: 'Authentication required',
                timestamp: new Date().toISOString(),
              },
              { status: 401 }
            );
          }

          const membership = await getUserDefaultTeam(user.id);

          if (!membership) {
            return Response.json(
              {
                success: false,
                message: 'No team membership found',
                timestamp: new Date().toISOString(),
              },
              { status: 404 }
            );
          }

          return Response.json(
            {
              success: true,
              data: {
                teamId: membership.teamId,
                role: membership.role,
                teamName: membership.teamName,
              },
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error('[GET /api/user/team] Error:', error);

          const handledError = handleApiError(error);
          return Response.json(
            {
              success: false,
              message: 'Failed to get user team',
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
