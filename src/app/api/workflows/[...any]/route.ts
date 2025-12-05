/**
 * Workflow Routes
 * Serves all QStash workflows for async AI task processing
 */

import { analyzeScriptWorkflow } from '@/app/api/workflows/[...any]/analyze-script-workflow';
import { characterSheetWorkflow } from '@/app/api/workflows/[...any]/character-sheet-workflow';
import { generateImageWorkflow } from '@/app/api/workflows/[...any]/image-workflow';
import { generateMotionWorkflow } from '@/app/api/workflows/[...any]/motion-workflow';
import { generateStoryboardWorkflow } from '@/app/api/workflows/[...any]/storyboard-workflow';
import { getQStashWebhookUrl } from '@/lib/utils/get-base-url';
import { serveMany } from '@upstash/workflow/dist/nextjs';

export const { POST } = serveMany(
  {
    storyboard: generateStoryboardWorkflow,
    image: generateImageWorkflow,
    motion: generateMotionWorkflow,
    'analyze-script': analyzeScriptWorkflow,
    'character-sheet': characterSheetWorkflow,
  },
  {
    baseUrl: getQStashWebhookUrl(),
    verbose: true,
  }
);
