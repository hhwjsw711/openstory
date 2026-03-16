/**
 * Accept Team Invitation API Endpoint
 * POST /api/teams/invitations/$invitationId/accept - Accept a team invitation
 */

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { requireUser } from '@/lib/auth/action-utils';
import { handleApiError, ValidationError } from '@/lib/errors';
import { createScopedDb } from '@/lib/db/scoped';

export const Route = createFileRoute(
  '/api/teams/invitations/$invitationId/accept'
)({
  server: {
    handlers: {
      POST: async ({ params }) => {
        try {
          const { invitationId } = params;

          // Validate invitation ID (token)
          if (!invitationId || invitationId.length < 10) {
            throw new ValidationError('Invalid invitation ID');
          }

          // Check authentication
          const user = await requireUser();

          // Accept invitation
          // Use a placeholder teamId — acceptInvitation looks up by token, not team
          const scopedDb = createScopedDb('__invitation__');
          const teamId = await scopedDb.teamManagement.acceptInvitation({
            token: invitationId,
            userId: user.id,
          });

          return json(
            {
              success: true,
              data: { teamId },
              message: 'Invitation accepted successfully',
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error(
            '[POST /api/teams/invitations/$invitationId/accept] Error:',
            error
          );

          const handledError = handleApiError(error);
          return json(
            {
              success: false,
              message: 'Failed to accept invitation',
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
