/**
 * User Server Functions
 * End-to-end type-safe functions for user-related operations
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { authMiddleware } from './middleware';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import {
  getUserDefaultTeam,
  getUserTeams,
  canAccessTeam,
} from '@/lib/db/helpers';

// ============================================================================
// Get User's Default Team
// ============================================================================

/**
 * Get the current user's default team
 * @returns The user's default team membership
 */
export const getUserDefaultTeamFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const membership = await getUserDefaultTeam(context.user.id);

    if (!membership) {
      throw new Error('No team membership found');
    }

    return {
      teamId: membership.teamId,
      role: membership.role,
      teamName: membership.teamName,
    };
  });

// ============================================================================
// Get User's Teams
// ============================================================================

/**
 * Get all teams the current user belongs to
 * @returns Array of team memberships
 */
export const getUserTeamsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const memberships = await getUserTeams(context.user.id);

    return memberships.map((m) => ({
      teamId: m.teamId,
      role: m.role,
      teamName: m.teamName,
      joinedAt: m.joinedAt.toISOString(),
    }));
  });

// ============================================================================
// Check Team Access
// ============================================================================

const checkTeamAccessInputSchema = z.object({
  teamId: ulidSchema,
});

/**
 * Check if the current user has access to a specific team
 * @returns Whether the user has access
 */
export const checkTeamAccessFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(checkTeamAccessInputSchema))
  .handler(async ({ data, context }) => {
    const hasAccess = await canAccessTeam(context.user.id, data.teamId);
    return { hasAccess };
  });
