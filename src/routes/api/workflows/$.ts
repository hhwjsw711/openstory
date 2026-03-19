/**
 * Workflow Routes
 * Serves all QStash workflows for async AI task processing
 */

import { initAIEventBridge } from '@/lib/observability/ai-event-bridge';
import { flushTracing, initTracing } from '@/lib/observability/langfuse';
import {
  initMemoryProfiler,
  recordMemorySample,
} from '@/lib/observability/memory-profiler';
import { getQStashClient } from '@/lib/workflow/client';
import { analyzeScriptWorkflow } from '@/lib/workflows/analyze-script-workflow';
import { characterBibleWorkflow } from '@/lib/workflows/character-bible-workflow';
import { characterSheetWorkflow } from '@/lib/workflows/character-sheet-workflow';
import { generateImageWorkflow } from '@/lib/workflows/image-workflow';
import { libraryLocationSheetWorkflow } from '@/lib/workflows/library-location-sheet-workflow';
import { libraryTalentSheetWorkflow } from '@/lib/workflows/library-talent-sheet-workflow';
import { locationBibleWorkflow } from '@/lib/workflows/location-bible-workflow';
import { locationMatchingWorkflow } from '@/lib/workflows/location-matching-workflow';
import { locationSheetWorkflow } from '@/lib/workflows/location-sheet-workflow';
import { mergeAudioVideoWorkflow } from '@/lib/workflows/merge-audio-video-workflow';
import { mergeVideoWorkflow } from '@/lib/workflows/merge-video-workflow';
import { motionPromptSceneWorkflow } from '@/lib/workflows/motion-prompt-scene-workflow';
import { motionPromptWorkflow } from '@/lib/workflows/motion-prompt-workflow';
import { generateMotionWorkflow } from '@/lib/workflows/motion-workflow';
import { generateMusicWorkflow } from '@/lib/workflows/music-workflow';
import { recastCharacterWorkflow } from '@/lib/workflows/recast-character-workflow';
import { recastLocationWorkflow } from '@/lib/workflows/recast-location-workflow';
import { regenerateFramesWorkflow } from '@/lib/workflows/regenerate-frames-workflow';
import { generateStoryboardWorkflow } from '@/lib/workflows/storyboard-workflow';
import { talentMatchingWorkflow } from '@/lib/workflows/talent-matching-workflow';
import { upscaleVariantWorkflow } from '@/lib/workflows/upscale-variant-workflow';
import { generateVariantWorkflow } from '@/lib/workflows/variant-workflow';
import { visualPromptSceneWorkflow } from '@/lib/workflows/visual-prompt-scene-workflow';
import { visualPromptWorkflow } from '@/lib/workflows/visual-prompt-workflow';
import { withApiLogging } from '@/lib/observability/api-logger';
import { createFileRoute } from '@tanstack/react-router';
import { serveMany } from '@upstash/workflow/tanstack';

let _handler: ReturnType<typeof serveMany> | null = null;
function getHandler() {
  if (!_handler) {
    // Initialize Langfuse tracing and AI event bridge at load
    initTracing();
    initAIEventBridge();
    initMemoryProfiler();

    _handler = serveMany(
      {
        storyboard: generateStoryboardWorkflow,
        image: generateImageWorkflow,
        motion: generateMotionWorkflow,
        'merge-audio-video': mergeAudioVideoWorkflow,
        'merge-video': mergeVideoWorkflow,
        'analyze-script': analyzeScriptWorkflow,
        'character-sheet': characterSheetWorkflow,
        'character-sheet-from-bible': characterBibleWorkflow,
        'library-talent-sheet': libraryTalentSheetWorkflow,
        'visual-prompts': visualPromptWorkflow,
        'variant-image': generateVariantWorkflow,
        'upscale-variant': upscaleVariantWorkflow,
        'recast-character': recastCharacterWorkflow,
        'recast-location': recastLocationWorkflow,
        'location-matching': locationMatchingWorkflow,
        'location-sheet': locationSheetWorkflow,
        'location-sheet-from-bible': locationBibleWorkflow,
        'library-location-sheet': libraryLocationSheetWorkflow,
        'regenerate-frames': regenerateFramesWorkflow,
        'talent-matching': talentMatchingWorkflow,
        'visual-prompt-scene': visualPromptSceneWorkflow,
        'motion-prompts': motionPromptWorkflow,
        'motion-prompt-scene': motionPromptSceneWorkflow,
        music: generateMusicWorkflow,
      },
      {
        qstashClient: getQStashClient(),
      }
    );
  }
  return _handler;
}

export const Route = createFileRoute('/api/workflows/$')({
  server: {
    handlers: {
      POST: withApiLogging('workflows', async ({ request }) => {
        const workflowName =
          new URL(request.url).pathname.split('/api/workflows/')[1] ??
          'unknown';
        recordMemorySample(workflowName, 'before');
        const response = await getHandler().POST({ request });
        recordMemorySample(workflowName, 'after');
        await flushTracing();
        return response;
      }),
    },
  },
});
