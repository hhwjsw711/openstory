import { z } from 'zod';

/**
 * Shared Zod schemas for style operations
 */

export const createStyleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  config: z.any().default({}),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().default(false),
  preview_url: z.string().optional().nullable(),
});

export const updateStyleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  config: z.any().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().optional(),
  preview_url: z.string().optional().nullable(),
});

export type CreateStyleInput = z.infer<typeof createStyleSchema>;
export type UpdateStyleInput = z.infer<typeof updateStyleSchema>;
