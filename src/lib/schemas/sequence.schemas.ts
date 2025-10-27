import { z } from 'zod';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { sequences } from '@/lib/db/schema/sequences';

/**
 * Shared Zod schemas for sequence operations
 * Generated from Drizzle schema with custom refinements
 */

export const createSequenceSchema = createInsertSchema(sequences, {
  title: (schema) => schema.min(1), // drizzle-zod auto-applies max from varchar(500)
  script: z.string().min(10).max(10000), // Override to make it required with business rules
}).omit({
  id: true,
  teamId: true, // Server determines from authenticated user
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
});

export const updateSequenceSchema = createUpdateSchema(sequences, {
  title: (schema) => schema.min(1), // drizzle-zod auto-applies max from varchar(500)
  script: (schema) => schema.min(10).max(10000), // Business rule: meaningful scripts
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
