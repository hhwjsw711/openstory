/**
 * Phase 5: Audio Design
 *
 * Schema for audio design generation results.
 */

import { sceneSchema } from '@/lib/ai/scene-analysis.schema';
import { z } from 'zod';

/**
 * Schema for audio design generation validation.
 * Uses .pick().required() from canonical sceneSchema to reuse field definitions and metadata.
 */
export const audioDesignGenerationResultSchema = z.object({
  status: z
    .enum(['success', 'error', 'rejected'])
    .catch('success')
    .meta({ description: 'Processing status: success, error, or rejected' }),
  scenes: z
    .array(
      sceneSchema
        .pick({
          sceneId: true,
          audioDesign: true,
        })
        .required()
    )
    .meta({ description: 'Array of scenes with audio design' }),
});
