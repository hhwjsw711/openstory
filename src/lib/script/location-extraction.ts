/**
 * Phase 2b: Location Extraction
 *
 * Schema for location extraction results.
 */

import { locationBibleEntrySchema } from '@/lib/ai/scene-analysis.schema';
import { z } from 'zod';

/**
 * Zod schema for validating location extraction results.
 */
export const locationExtractionResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']).catch('success'),
  locationBible: z.array(locationBibleEntrySchema).catch([]),
});
