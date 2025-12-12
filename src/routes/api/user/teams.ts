/**
 * User Teams API Endpoint
 * GET /api/user/teams - Get all user teams
 */

import { createFileRoute } from '@tanstack/react-router';
import { getUser } from '@/lib/auth/server';
import { handleApiError } from '@/lib/errors';
import { getUserTeams } from '@/lib/db/helpers';

export const Route = createFileRoute('/api/user/teams')({
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

          const memberships = await getUserTeams(user.id);

          const teams = memberships.map((m) => ({
            teamId: m.teamId,
            role: m.role,
            teamName: m.teamName,
            joinedAt: m.joinedAt.toISOString(),
          }));

          return Response.json(
            {
              success: true,
              data: teams,
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error('[GET /api/user/teams] Error:', error);

          const handledError = handleApiError(error);
          return Response.json(
            {
              success: false,
              message: 'Failed to get user teams',
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
