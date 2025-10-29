import { z } from 'zod';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { sequences } from '@/lib/db/schema/sequences';
import { getAllModelIds, DEFAULT_ANALYSIS_MODEL } from '@/lib/ai/models.config';

/**
 * Shared Zod schemas for sequence operations
 * Generated from Drizzle schema with custom refinements
 */

// Get valid model IDs for validation
const validModelIds = getAllModelIds();

export const createSequenceSchema = createInsertSchema(sequences, {
  title: (schema) => schema.min(1), // drizzle-zod auto-applies max from varchar(500)
  script: z.string().min(10).max(10000), // Override to make it required with business rules
})
  .omit({
    id: true,
    teamId: true, // Server determines from authenticated user
    status: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
    updatedBy: true,
    analysisModel: true, // Omit singular model - we'll use analysisModels array
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
  });

export const updateSequenceSchema = createUpdateSchema(sequences, {
  title: (schema) => schema.min(1), // drizzle-zod auto-applies max from varchar(500)
  script: (schema) => schema.min(10).max(10000), // Business rule: meaningful scripts
  analysisModel: (schema) =>
    schema.refine((val) => (validModelIds as readonly string[]).includes(val), {
      message: 'Invalid analysis model',
    }),
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
