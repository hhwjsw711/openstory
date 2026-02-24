/**
 * Phase 3: Visual Prompt Generation
 *
 * Schema for visual prompt generation results.
 */

import {
  continuitySchema,
  sceneSchema,
  visualPromptSchema,
} from '@/lib/ai/scene-analysis.schema';
import { z } from 'zod';

/**
 * Schema for visual prompt generation validation.
 * Uses .pick().required() from canonical sceneSchema and extends with prompts.visual + continuity.
 */
export const visualPromptGenerationResultSchema = z.object({
  status: z
    .enum(['success', 'error', 'rejected'])
    .catch('success')
    .meta({ description: 'Processing status: success, error, or rejected' }),
  scenes: z
    .array(
      sceneSchema
        .pick({
          sceneId: true,
        })
        .required()
        .extend({
          visual: visualPromptSchema.meta({
            description: 'Image generation prompt data',
          }),
          continuity: continuitySchema.meta({
            description: 'Continuity tracking for scene consistency',
          }),
        })
    )
    .meta({ description: 'Array of scenes with visual prompts' }),
});
