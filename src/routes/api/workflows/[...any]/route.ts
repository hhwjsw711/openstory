/**
 * Workflow Routes
 * Serves all QStash workflows for async AI task processing
 */

import { analyzeScriptWorkflow } from '@/routes/api/workflows/[...any]/analyze-script-workflow';
import { characterSheetWorkflow } from '@/routes/api/workflows/[...any]/character-sheet-workflow';
import { generateImageWorkflow } from '@/routes/api/workflows/[...any]/image-workflow';
import { generateMotionWorkflow } from '@/routes/api/workflows/[...any]/motion-workflow';
import { generateStoryboardWorkflow } from '@/routes/api/workflows/[...any]/storyboard-workflow';
import { getQStashWebhookUrl } from '@/lib/utils/get-base-url';
import { serveMany } from '@upstash/workflow/dist/nextjs';
import { characterBibleWorkflow } from './character-bible-workflow';
import { upscaleVariantWorkflow } from './upscale-variant-workflow';
import { visualPromptWorkflow } from './visual-prompt-workflow';
import { generateVariantWorkflow } from './variant-workflow';

export const { POST } = serveMany(
  {
    storyboard: generateStoryboardWorkflow,
    image: generateImageWorkflow,
    motion: generateMotionWorkflow,
    'analyze-script': analyzeScriptWorkflow,
    'character-sheet': characterSheetWorkflow,
    'character-sheet-from-bible': characterBibleWorkflow,
    'visual-prompts': visualPromptWorkflow,
    'variant-image': generateVariantWorkflow,
    'upscale-variant': upscaleVariantWorkflow,
  },
  {
    baseUrl: getQStashWebhookUrl(),
    verbose: true,
  }
);
