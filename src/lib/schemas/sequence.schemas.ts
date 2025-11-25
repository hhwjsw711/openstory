import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
} from '@/lib/ai/models';
import { DEFAULT_ANALYSIS_MODEL, getAllModelIds } from '@/lib/ai/models.config';
import { aspectRatioSchema } from '@/lib/constants/aspect-ratios';
import { sequences } from '@/lib/db/schema/sequences';
import { ulidSchemaOptional } from '@/lib/schemas/id.schemas';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Shared Zod schemas for sequence operations
 * Generated from Drizzle schema with custom refinements
 */

// Get valid model IDs for validation
const validModelIds = getAllModelIds();
const validImageModelKeys = Object.keys(IMAGE_MODELS) as readonly string[];
const validVideoModelKeys = Object.keys(
  IMAGE_TO_VIDEO_MODELS
) as readonly string[];

export const createSequenceSchema = createInsertSchema(sequences, {
  title: (schema) => schema.min(1), // drizzle-zod auto-applies max from varchar(500)
  script: z.string().min(10).max(10000), // Override to make it required with business rules
  teamId: ulidSchemaOptional, // Optional - will use user's default team if not provided
  aspectRatio: aspectRatioSchema.optional(), // Optional - defaults to '16:9' in database
})
  .omit({
    id: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
    updatedBy: true,
    analysisModel: true, // Omit singular model - we'll use analysisModels array
    imageModel: true, // Omit - will use imageModel field in extend
    videoModel: true, // Omit - will use videoModel field in extend
  })
  .extend({
    // Accept array of models for multi-model sequence creation
    analysisModels: z
      .array(
        z
          .string()
          .refine((val) => (validModelIds as readonly string[]).includes(val), {
            message: 'Invalid analysis model',
          })
      )
      .min(1, 'At least one model must be selected')
      .default([DEFAULT_ANALYSIS_MODEL]),
    // Image model selection (model key, not full ID)
    imageModel: z
      .string()
      .refine((val) => validImageModelKeys.includes(val), {
        message: 'Invalid image model',
      })
      .default(DEFAULT_IMAGE_MODEL),
    // Video model selection (model key, not full ID)
    videoModel: z
      .string()
      .refine((val) => validVideoModelKeys.includes(val), {
        message: 'Invalid video model',
      })
      .default(DEFAULT_VIDEO_MODEL),
  });

export const updateSequenceSchema = createUpdateSchema(sequences, {
  title: (schema) => schema.min(1), // drizzle-zod auto-applies max from varchar(500)
  script: (schema) => schema.min(10).max(10000), // Business rule: meaningful scripts
  analysisModel: (schema) =>
    schema.refine((val) => (validModelIds as readonly string[]).includes(val), {
      message: 'Invalid analysis model',
    }),
  imageModel: (schema) =>
    schema.refine((val) => validImageModelKeys.includes(val), {
      message: 'Invalid image model',
    }),
  videoModel: (schema) =>
    schema.refine((val) => validVideoModelKeys.includes(val), {
      message: 'Invalid video model',
    }),
  aspectRatio: aspectRatioSchema.optional(),
}).omit({
  id: true,
  teamId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
});

export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;
export type UpdateSequenceInput = z.infer<typeof updateSequenceSchema>;
