import { z } from 'zod';

/**
 * Shared Zod schemas for team operations
 */

export const inviteMemberSchema = z.object({
  teamId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['member', 'admin', 'viewer']).default('member'),
});

export const removeMemberSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const updateRoleSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  newRole: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
