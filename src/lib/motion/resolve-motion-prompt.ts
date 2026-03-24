/**
 * Shared Motion Prompt Resolution
 *
 * Resolves the motion prompt string for a frame, applying model-specific
 * assembly when structured MotionPrompt data is available.
 *
 * Priority: user override → model-specific assembly → legacy fallback
 */

import type { MotionPrompt } from '@/lib/ai/scene-analysis.schema';
import {
  type ImageToVideoModel,
  videoModelSupportsAudio,
} from '@/lib/ai/models';
import { assembleMotionPrompt } from './assemble-motion-prompt';

type FramePromptData = {
  motionPrompt: string | null;
  metadata: { prompts?: { motion?: MotionPrompt } } | null;
  description: string | null;
};

/**
 * Resolve the motion prompt for a frame, formatted for the target video model.
 *
 * - If the user has manually edited the prompt (frame.motionPrompt), it wins
 *   but dialogue/audio are appended for audio-capable models.
 * - If structured MotionPrompt data exists, assemble a model-specific prompt.
 * - Otherwise fall back to frame.description.
 */
export function resolveMotionPrompt(
  frame: FramePromptData,
  model: ImageToVideoModel
): string {
  const motionPromptData = frame.metadata?.prompts?.motion;

  // User override: manually edited prompt string
  if (frame.motionPrompt) {
    // For audio models, enrich the user's prompt with dialogue/audio if available
    if (videoModelSupportsAudio(model) && motionPromptData) {
      return assembleMotionPrompt({
        motionPrompt: { ...motionPromptData, fullPrompt: frame.motionPrompt },
        model,
      });
    }
    return frame.motionPrompt;
  }

  // Structured data available — assemble for target model
  if (motionPromptData) {
    return assembleMotionPrompt({
      motionPrompt: motionPromptData,
      model,
    });
  }

  // Legacy fallback
  return frame.description || '';
}
