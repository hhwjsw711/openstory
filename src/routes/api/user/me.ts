/**
 * Current User API Endpoint
 * GET /api/user/me - Get current user
 */

import { createFileRoute } from '@tanstack/react-router';
import { getSessionFn } from '@/lib/auth/server';
import { ensureUserAndTeam, getUserDefaultTeam } from '@/lib/db/helpers';
import { handleApiError } from '@/lib/errors';

export const Route = createFileRoute('/api/user/me')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const session = await getSessionFn();

          if (!session?.user) {
            // No session exists - authentication required
            return Response.json(
              {
                success: false,
                message: 'Authentication required',
                timestamp: new Date().toISOString(),
              },
              { status: 401 }
            );
          }

          const authUser = session.user;

          // Ensure user and team exist - this handles both:
          // 1. User doesn't exist in database (creates user + team)
          // 2. User exists but has no team (creates team only)
          const ensureResult = await ensureUserAndTeam(authUser);
          console.log('ensureResult', JSON.stringify(ensureResult, null, 2));
          if (!ensureResult.success || !ensureResult.data) {
            return Response.json(
              {
                success: false,
                message: ensureResult.error || 'Failed to ensure user and team',
                timestamp: new Date().toISOString(),
              },
              { status: 500 }
            );
          }

          // Get complete team info with team name
          const teamMembership = await getUserDefaultTeam(authUser.id);
          console.log(
            'teamMembership',
            JSON.stringify(teamMembership, null, 2)
          );

          return Response.json(
            {
              success: true,
              data: {
                user: ensureResult.data,
                isAuthenticated: true,
                teamId: teamMembership?.teamId,
                teamRole: teamMembership?.role,
                teamName: teamMembership?.teamName,
              },
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error('[GET /api/user/me] Error:', error);

          const handledError = handleApiError(error);
          return Response.json(
            {
              success: false,
              message: 'Failed to get user',
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
