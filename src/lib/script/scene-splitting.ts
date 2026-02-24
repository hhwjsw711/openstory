/**
 * Phase 1: Scene Splitting
 *
 * Schema for scene splitting results.
 */

import {
  projectMetadataSchema,
  sceneSchema,
} from '@/lib/ai/scene-analysis.schema';
import { z } from 'zod';

/**
 * Zod schema for validating scene splitting results.
 * Uses .pick() from canonical sceneSchema to reuse field definitions and metadata.
 */
export const sceneSplittingResultSchema = z.object({
  status: z
    .enum(['success', 'error', 'rejected'])
    .catch('success')
    .meta({ description: 'Processing status: success, error, or rejected' }),
  projectMetadata: projectMetadataSchema.meta({
    description: 'Project-level metadata extracted from script',
  }),
  scenes: z
    .array(
      sceneSchema
        .pick({
          sceneId: true,
          sceneNumber: true,
          originalScript: true,
          metadata: true,
        })
        .required()
    )
    .meta({ description: 'Array of scenes split from the script' }),
});
