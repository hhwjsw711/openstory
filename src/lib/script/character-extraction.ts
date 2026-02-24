/**
 * Phase 2: Character Extraction
 *
 * Schema for character extraction results.
 */

import { sceneAnalysisSchema } from '@/lib/ai/scene-analysis.schema';

/**
 * Zod schema for validating character extraction results.
 * Reuses canonical schemas from scene-analysis.schema.ts for consistency and metadata.
 */
export const characterExtractionResultSchema = sceneAnalysisSchema
  .pick({
    status: true,
    characterBible: true,
  })
  .required();
