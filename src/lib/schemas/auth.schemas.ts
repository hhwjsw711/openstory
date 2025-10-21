import { z } from "zod";

/**
 * Shared Zod schemas for authentication operations
 */

export const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
