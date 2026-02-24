/**
 * Phase 4: Motion Prompt Generation
 *
 * Schema for motion prompt generation results.
 */

import {
  motionPromptSchema,
  sceneSchema,
} from '@/lib/ai/scene-analysis.schema';
import { z } from 'zod';

/**
 * Schema for motion prompt generation validation.
 * Uses .pick().required() from canonical sceneSchema and extends with prompts.motion.
 *
 * Note: The motion field uses a preprocess to handle AI model variations.
 * Some models return motion as an array instead of an object - we take the first element.
 */
export const motionPromptGenerationResultSchema = z.object({
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
          prompts: z
            .object({
              // Handle AI returning motion as array (take first element) or object
              motion: z
                .preprocess((val) => {
                  if (Array.isArray(val) && val.length > 0) {
                    console.warn(
                      '[MotionPrompts] AI returned motion as array, using first element'
                    );
                    return val[0];
                  }
                  return val;
                }, motionPromptSchema)
                .meta({ description: 'Motion/video generation prompt data' }),
            })
            .meta({ description: 'Motion generation prompts for this scene' }),
        })
    )
    .meta({ description: 'Array of scenes with motion prompts' }),
});
