import { z } from 'zod';
import { ulidSchema } from '@/lib/schemas/id.schemas';

/**
 * Shared Zod schemas for team operations
 */

export const inviteMemberSchema = z.object({
  teamId: ulidSchema,
  email: z.string().email(),
  role: z.enum(['member', 'admin', 'viewer']).default('member'),
});

export const removeMemberSchema = z.object({
  teamId: ulidSchema,
  userId: ulidSchema,
});

export const updateRoleSchema = z.object({
  teamId: ulidSchema,
  userId: ulidSchema,
  newRole: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
