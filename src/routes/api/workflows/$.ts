/**
 * Workflow Routes
 * Serves all QStash workflows for async AI task processing
 */

import { createFileRoute } from '@tanstack/react-router';
import { flushTracing, initTracing } from '@/lib/observability/langfuse';
import { analyzeScriptWorkflow } from '@/lib/workflows/analyze-script-workflow';
import { characterBibleWorkflow } from '@/lib/workflows/character-bible-workflow';
import { characterSheetWorkflow } from '@/lib/workflows/character-sheet-workflow';
import { generateImageWorkflow } from '@/lib/workflows/image-workflow';
import { libraryTalentSheetWorkflow } from '@/lib/workflows/library-talent-sheet-workflow';
import { mergeVideoWorkflow } from '@/lib/workflows/merge-video-workflow';
import { generateMotionWorkflow } from '@/lib/workflows/motion-workflow';
import { recastCharacterWorkflow } from '@/lib/workflows/recast-character-workflow';
import { regenerateFramesWorkflow } from '@/lib/workflows/regenerate-frames-workflow';
import { generateStoryboardWorkflow } from '@/lib/workflows/storyboard-workflow';
import { upscaleVariantWorkflow } from '@/lib/workflows/upscale-variant-workflow';
import { generateVariantWorkflow } from '@/lib/workflows/variant-workflow';
import { visualPromptWorkflow } from '@/lib/workflows/visual-prompt-workflow';
import { visualPromptSceneWorkflow } from '@/lib/workflows/visual-prompt-scene-workflow';
import { getQStashClient } from '@/lib/workflow/client';
import { serveMany } from '@upstash/workflow/tanstack';
import { motionPromptWorkflow } from '@/lib/workflows/motion-prompt-workflow';
import { motionPromptSceneWorkflow } from '@/lib/workflows/motion-prompt-scene-workflow';

// Initialize Langfuse tracing at module load
initTracing();

const handler = serveMany(
  {
    storyboard: generateStoryboardWorkflow,
    image: generateImageWorkflow,
    motion: generateMotionWorkflow,
    'merge-video': mergeVideoWorkflow,
    'analyze-script': analyzeScriptWorkflow,
    'character-sheet': characterSheetWorkflow,
    'character-sheet-from-bible': characterBibleWorkflow,
    'library-talent-sheet': libraryTalentSheetWorkflow,
    'visual-prompts': visualPromptWorkflow,
    'variant-image': generateVariantWorkflow,
    'upscale-variant': upscaleVariantWorkflow,
    'recast-character': recastCharacterWorkflow,
    'regenerate-frames': regenerateFramesWorkflow,
    'visual-prompt-scene': visualPromptSceneWorkflow,
    'motion-prompts': motionPromptWorkflow,
    'motion-prompt-scene': motionPromptSceneWorkflow,
  },
  {
    qstashClient: getQStashClient(), // This must be the QStash client
  }
);

export const Route = createFileRoute('/api/workflows/$')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const response = await handler.POST({ request });
        await flushTracing();
        return response;
      },
    },
  },
});
