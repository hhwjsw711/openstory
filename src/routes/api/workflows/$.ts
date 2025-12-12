/**
 * Workflow Routes
 * Serves all QStash workflows for async AI task processing
 */

import { createFileRoute } from '@tanstack/react-router';
import { analyzeScriptWorkflow } from '@/lib/workflows/analyze-script-workflow';
import { characterSheetWorkflow } from '@/lib/workflows/character-sheet-workflow';
import { generateImageWorkflow } from '@/lib/workflows/image-workflow';
import { generateMotionWorkflow } from '@/lib/workflows/motion-workflow';
import { generateStoryboardWorkflow } from '@/lib/workflows/storyboard-workflow';
import { characterBibleWorkflow } from '@/lib/workflows/character-bible-workflow';
import { upscaleVariantWorkflow } from '@/lib/workflows/upscale-variant-workflow';
import { visualPromptWorkflow } from '@/lib/workflows/visual-prompt-workflow';
import { generateVariantWorkflow } from '@/lib/workflows/variant-workflow';
import { getQStashWebhookUrl } from '@/lib/utils/get-base-url';
import { serveMany } from '@upstash/workflow/tanstack';

const handler = serveMany(
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

export const Route = createFileRoute('/api/workflows/$')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return handler.POST({ request });
      },
    },
  },
});
