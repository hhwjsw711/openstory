/**
 * Team Member Management API Endpoint
 * DELETE /api/teams/$teamId/members/$userId - Remove a member (admin/owner only)
 * PATCH /api/teams/$teamId/members/$userId - Update member role (owner only)
 */

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { z } from 'zod';
import {
  requireTeamAdminAccess,
  requireTeamOwnerAccess,
  requireUser,
} from '@/lib/auth/action-utils';
import { handleApiError, ValidationError } from '@/lib/errors';
import { teamService } from '@/lib/services/team.service';
import { ulidSchema } from '@/lib/schemas/id.schemas';

const updateRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export const Route = createFileRoute('/api/teams/$teamId/members/$userId')({
  server: {
    handlers: {
      DELETE: async ({ params }) => {
        try {
          const { teamId, userId } = params;

          // Validate ULIDs
          try {
            ulidSchema.parse(teamId);
            ulidSchema.parse(userId);
          } catch {
            throw new ValidationError('Invalid team ID or user ID format');
          }

          // Check authentication and authorization
          const user = await requireUser();
          await requireTeamAdminAccess(user.id, teamId);

          // Remove member
          await teamService.removeMember({
            teamId,
            userId,
            requestingUserId: user.id,
          });

          return json(
            {
              success: true,
              message: 'Member removed successfully',
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error(
            '[DELETE /api/teams/$teamId/members/$userId] Error:',
            error
          );
          const handledError = handleApiError(error);
          return json(
            {
              success: false,
              message: 'Failed to remove member',
              error: handledError.toJSON(),
              timestamp: new Date().toISOString(),
            },
            { status: handledError.statusCode }
          );
        }
      },

      PATCH: async ({ request, params }) => {
        try {
          const { teamId, userId } = params;

          // Validate ULIDs
          try {
            ulidSchema.parse(teamId);
            ulidSchema.parse(userId);
          } catch {
            throw new ValidationError('Invalid team ID or user ID format');
          }

          // Parse and validate request body
          const body = await request.json();
          const validated = updateRoleSchema.parse(body);

          // Check authentication and authorization
          const user = await requireUser();
          await requireTeamOwnerAccess(user.id, teamId);

          // Update role
          await teamService.updateMemberRole({
            teamId,
            userId,
            newRole: validated.role,
            requestingUserId: user.id,
          });

          return json(
            {
              success: true,
              message: 'Role updated successfully',
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error(
            '[PATCH /api/teams/$teamId/members/$userId] Error:',
            error
          );

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
          return json(
            {
              success: false,
              message: 'Failed to update role',
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
