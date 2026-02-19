/**
 * Merge Videos Service
 * Handles stitching multiple video segments into a single video using fal.ai's ffmpeg API
 * Uses @tanstack/ai-fal adapter for queue management and polling
 */

import { getEnv } from '#env';
import { generateVideo, getVideoJobStatus } from '@tanstack/ai';
import { falVideo } from '@tanstack/ai-fal';

// Model ID for the fal.ai ffmpeg merge endpoint
// Typed as string to use the adapter's generic fallback — the merge endpoint
// isn't a video generation model so its fal types lack aspect_ratio/prompt fields
const MERGE_VIDEOS_MODEL_ID: string = 'fal-ai/ffmpeg-api/merge-videos';

export type MergeVideosResult = {
  videoUrl: string;
  requestId?: string;
  // ffmpeg merge cost is negligible — adapter doesn't expose raw fal metadata
  cost: number;
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

  const adapter = falVideo(MERGE_VIDEOS_MODEL_ID, {
    apiKey: falApiKey ?? getEnv().FAL_KEY ?? '',
  });

  // Submit merge job — prompt is unused by the ffmpeg endpoint,
  // actual parameters go through modelOptions
  const job = await generateVideo({
    adapter,
    prompt: '',
    modelOptions: {
      video_urls: videoUrls,
      ...(targetFps && { target_fps: targetFps }),
      ...(resolution && { resolution }),
    },
  });

  const requestId = job.jobId;
  console.log(`[Merge Videos] Job submitted: ${requestId}`);

  // Poll for completion
  const pollInterval = 5000;
  const maxPollTime = 10 * 60 * 1000; // 10 minutes
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTime) {
    const status = await getVideoJobStatus({ adapter, jobId: requestId });

    if (status.status === 'completed' && status.url) {
      console.log(`[Merge Videos] Completed`);
      return {
        videoUrl: status.url,
        requestId,
        cost: 0,
        metadata: {
          inputCount: videoUrls.length,
          targetFps,
          resolution,
          generatedAt: new Date().toISOString(),
        },
      };
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Video merge failed');
    }

    if (status.progress !== undefined) {
      console.log(`[Merge Videos] Progress: ${status.progress}%`);
    } else {
      console.log(`[Merge Videos] Status: ${status.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Video merge timed out after 10 minutes');
}
