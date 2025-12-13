/**
 * Team Server Functions
 * End-to-end type-safe functions for team management operations
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import {
  teamMemberAccessMiddleware,
  teamAdminAccessMiddleware,
  teamOwnerAccessMiddleware,
} from './middleware';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { teamService } from '@/lib/services/team.service';
import type { TeamRole } from '@/lib/auth/permissions';

// ============================================================================
// List Team Members
// ============================================================================

/**
 * Get all members of a team
 * @returns Array of team members
 */
export const getTeamMembersFn = createServerFn({ method: 'GET' })
  .middleware([teamMemberAccessMiddleware])
  .handler(async ({ context }) => {
    return teamService.getMembers(context.teamId);
  });

// ============================================================================
// Invite Member
// ============================================================================

const inviteMemberInputSchema = z.object({
  teamId: ulidSchema,
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'admin', 'viewer']).default('member'),
});

/**
 * Invite a new member to the team (admin/owner only)
 * @returns The created invitation
 */
export const inviteTeamMemberFn = createServerFn({ method: 'POST' })
  .middleware([teamAdminAccessMiddleware])
  .inputValidator(zodValidator(inviteMemberInputSchema))
  .handler(async ({ data, context }) => {
    return teamService.createInvitation({
      teamId: data.teamId,
      email: data.email,
      role: data.role,
      invitedBy: context.user.id,
    });
  });

// ============================================================================
// Remove Member
// ============================================================================

const removeMemberInputSchema = z.object({
  teamId: ulidSchema,
  userId: ulidSchema,
});

/**
 * Remove a member from the team (admin/owner only)
 */
export const removeTeamMemberFn = createServerFn({ method: 'POST' })
  .middleware([teamAdminAccessMiddleware])
  .inputValidator(zodValidator(removeMemberInputSchema))
  .handler(async ({ data, context }) => {
    await teamService.removeMember({
      teamId: data.teamId,
      userId: data.userId,
      requestingUserId: context.user.id,
    });
    return { success: true };
  });

// ============================================================================
// Update Member Role
// ============================================================================

const updateMemberRoleInputSchema = z.object({
  teamId: ulidSchema,
  userId: ulidSchema,
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

/**
 * Update a team member's role (owner only)
 */
export const updateTeamMemberRoleFn = createServerFn({ method: 'POST' })
  .middleware([teamOwnerAccessMiddleware])
  .inputValidator(zodValidator(updateMemberRoleInputSchema))
  .handler(async ({ data, context }) => {
    await teamService.updateMemberRole({
      teamId: data.teamId,
      userId: data.userId,
      newRole: data.role,
      requestingUserId: context.user.id,
    });
    return { success: true };
  });
