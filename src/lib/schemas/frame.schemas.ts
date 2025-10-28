import { z } from 'zod';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { frames } from '@/lib/db/schema/sequences';
import { IMAGE_MODELS, IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';

/**
 * Shared Zod schemas for frame operations
 * Generated from Drizzle schema with custom refinements
 *
 * Note: Frame metadata field should contain FrameMetadata structure (see src/lib/ai/frame.schema.ts)
 * which includes complete Scene data from script analysis. The schemas below validate structure
 * but do not enforce FrameMetadata typing to maintain flexibility.
 */

export const createFrameSchema = createInsertSchema(frames, {
  description: (schema) => schema.min(1).max(5000),
  durationMs: (schema) => schema.min(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateFrameSchema = createUpdateSchema(frames, {
  description: (schema) => schema.min(1).max(5000),
  durationMs: (schema) => schema.min(1),
}).omit({
  id: true,
  sequenceId: true,
  createdAt: true,
  updatedAt: true,
});

export const deleteFrameSchema = z.object({
  id: z.string().uuid(),
});

export const generateFramesSchema = z.object({
  sequenceId: z.string().uuid(),
  options: z
    .object({
      framesPerScene: z.number().min(1).max(10).optional(),
      generateThumbnails: z.boolean().optional(),
      generateDescriptions: z.boolean().optional(),
      aiProvider: z.enum(['openai', 'anthropic', 'openrouter']).optional(),
      regenerateAll: z.boolean().optional(),
    })
    .optional(),
});

export const regenerateFrameSchema = z.object({
  regenerateDescription: z.boolean().optional(),
  regenerateThumbnail: z.boolean().optional(),
  model: z
    .enum(Object.keys(IMAGE_MODELS) as [keyof typeof IMAGE_MODELS])
    .optional(),
});

export const generateMotionSchema = z.object({
  model: z
    .enum(
      Object.keys(IMAGE_TO_VIDEO_MODELS) as [keyof typeof IMAGE_TO_VIDEO_MODELS]
    )
    .optional(),
  duration: z.number().min(1).max(10).optional(),
  fps: z.number().min(7).max(30).optional(),
  motionBucket: z.number().min(1).max(255).optional(),
});

// Schemas for API endpoint frame creation (sequenceId comes from URL params)
export const singleFrameSchema = createFrameSchema.omit({ sequenceId: true });

export const bulkFrameSchema = z.object({
  frames: z.array(createFrameSchema.omit({ sequenceId: true })).min(1),
});

export type CreateFrameInput = z.infer<typeof createFrameSchema>;
export type UpdateFrameInput = z.infer<typeof updateFrameSchema>;
export type DeleteFrameInput = z.infer<typeof deleteFrameSchema>;
export type GenerateFramesInput = z.infer<typeof generateFramesSchema>;
export type RegenerateFrameInput = z.infer<typeof regenerateFrameSchema>;
export type GenerateMotionInput = z.infer<typeof generateMotionSchema>;
export type SingleFrameInput = z.infer<typeof singleFrameSchema>;
export type BulkFrameInput = z.infer<typeof bulkFrameSchema>;
