/**
 * Merge Videos Service
 * Handles stitching multiple video segments into a single video using fal.ai's ffmpeg API
 */

import { getEnv } from '#env';
import type { QueueStatus } from '@fal-ai/client';
import { createFalClient } from '@fal-ai/client';

// Model ID for the fal.ai ffmpeg merge endpoint
const MERGE_VIDEOS_MODEL_ID = 'fal-ai/ffmpeg-api/merge-videos';

export type MergeVideosResult = {
  videoUrl: string;
  requestId?: string;
  metadata: {
    inputCount: number;
    targetFps?: number;
    resolution?: { width: number; height: number };
    generatedAt: string;
  };
};

/**
 * Merge multiple video segments into a single video using fal.ai's ffmpeg API
 * Videos are concatenated in the order provided
 *
 * @param videoUrls - Array of video URLs to merge (in order)
 * @param targetFps - Target frames per second (1-60, defaults to lowest of inputs)
 * @param resolution - Target resolution (512-2048 per dimension)
 */
export async function mergeVideos(
  videoUrls: string[],
  targetFps?: number,
  resolution?: { width: number; height: number },
  falApiKey?: string
): Promise<MergeVideosResult> {
  if (videoUrls.length === 0) {
    throw new Error('At least one video URL is required');
  }

  console.log(`[Merge Videos] Merging ${videoUrls.length} videos`, {
    targetFps,
    resolution,
  });

  // Build input for fal.ai API
  const input = {
    video_urls: videoUrls,
    ...(targetFps && { target_fps: targetFps }),
    ...(resolution && { resolution }),
  };

  // Track request ID from enqueue callback
  let requestId: string | undefined;

  // Configure fal client (supports user-provided keys)
  const fal = createFalClient({
    credentials: falApiKey ?? getEnv().FAL_KEY ?? '',
  });

  // Call the Fal.ai merge endpoint
  const result = await fal.subscribe(MERGE_VIDEOS_MODEL_ID, {
    input,
    logs: true,
    pollInterval: 5000,
    onEnqueue: (reqId: string) => {
      requestId = reqId;
      console.log(`[Merge Videos] Request enqueued: ${reqId}`);
    },
    onQueueUpdate: (update: QueueStatus) => {
      if (update.status === 'IN_QUEUE' && 'queue_position' in update) {
        console.log(`[Merge Videos] Queue position: ${update.queue_position}`);
      }
      if (update.status === 'COMPLETED') {
        console.log(
          `[Merge Videos] Completed in ${update.metrics?.inference_time || 'unknown'}s`
        );
      }
    },
  });

  // The fal client returns typed data for this endpoint
  const videoUrl = result.data.video.url;

  if (!videoUrl) {
    throw new Error('No video URL returned from merge operation');
  }

  return {
    videoUrl,
    requestId: requestId ?? result.requestId,
    metadata: {
      inputCount: videoUrls.length,
      targetFps,
      resolution,
      generatedAt: new Date().toISOString(),
    },
  };
}
