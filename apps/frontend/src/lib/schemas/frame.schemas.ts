import { z } from "zod";
import type { Json } from "@/types/database";

/**
 * Shared Zod schemas for frame operations
 */

export const createFrameSchema = z.object({
  sequence_id: z.string().uuid(),
  description: z.string().min(1).max(5000),
  order_index: z.number().int(),
  thumbnail_url: z.string().url().optional(),
  video_url: z.string().url().optional(),
  duration_ms: z.number().int().min(1).optional(),
  metadata: z.any().optional() as z.ZodType<Json | undefined>,
});

export const updateFrameSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(5000).optional(),
  order_index: z.number().int().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  video_url: z.string().url().nullable().optional(),
  duration_ms: z.number().int().min(1).nullable().optional(),
  metadata: z.any().nullable().optional() as z.ZodType<Json | null | undefined>,
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
      aiProvider: z.enum(["openai", "anthropic", "openrouter"]).optional(),
      regenerateAll: z.boolean().optional(),
    })
    .optional(),
});

export const regenerateFrameSchema = z.object({
  frameId: z.string().uuid(),
  regenerateDescription: z.boolean().optional(),
  regenerateThumbnail: z.boolean().optional(),
});

export const generateMotionSchema = z.object({
  model: z.string().optional(),
  duration: z.number().min(1).max(10).optional(),
  fps: z.number().min(7).max(30).optional(),
  motionBucket: z.number().min(1).max(255).optional(),
});

export type CreateFrameInput = z.infer<typeof createFrameSchema>;
export type UpdateFrameInput = z.infer<typeof updateFrameSchema>;
export type DeleteFrameInput = z.infer<typeof deleteFrameSchema>;
export type GenerateFramesInput = z.infer<typeof generateFramesSchema>;
export type RegenerateFrameInput = z.infer<typeof regenerateFrameSchema>;
export type GenerateMotionInput = z.infer<typeof generateMotionSchema>;
