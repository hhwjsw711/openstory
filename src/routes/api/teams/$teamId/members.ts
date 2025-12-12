/**
 * Team Members API Endpoint
 * GET /api/teams/$teamId/members - List team members
 */

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { requireTeamMemberAccess, requireUser } from '@/lib/auth/action-utils';
import { handleApiError, ValidationError } from '@/lib/errors';
import { teamService } from '@/lib/services/team.service';
import { ulidSchema } from '@/lib/schemas/id.schemas';

export const Route = createFileRoute('/api/teams/$teamId/members')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { teamId } = params;

          // Validate ULID
          try {
            ulidSchema.parse(teamId);
          } catch {
            throw new ValidationError('Invalid team ID format');
          }

          // Check authentication and authorization
          const user = await requireUser();
          await requireTeamMemberAccess(user.id, teamId);

          // Get team members
          const members = await teamService.getMembers(teamId);

          return json(
            {
              success: true,
              data: members,
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error('[GET /api/teams/$teamId/members] Error:', error);
          const handledError = handleApiError(error);
          return json(
            {
              success: false,
              message: 'Failed to fetch team members',
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
