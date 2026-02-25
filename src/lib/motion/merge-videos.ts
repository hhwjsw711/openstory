import { generateVideo, getVideoJobStatus } from '@tanstack/ai';
import { falVideo } from '@tanstack/ai-fal';
import { apiKeyService } from '../byok/api-key.service';

// Typed as `string` so the adapter uses its generic fallback -- the merge
// endpoint isn't a video generation model, so fal types lack aspect_ratio/prompt
const MERGE_VIDEOS_MODEL_ID: string = 'fal-ai/ffmpeg-api/merge-videos';

export type MergeVideosResult = {
  videoUrl: string;
  requestId?: string;
  cost: number;
  metadata: {
    inputCount: number;
    targetFps?: number;
    resolution?: { width: number; height: number };
    generatedAt: string;
    usedOwnKey: boolean;
  };
};

/** Merge multiple video segments into a single video via fal.ai ffmpeg API */
export async function mergeVideos({
  teamId,
  videoUrls,
  targetFps,
  resolution,
}: {
  teamId?: string; // required to resolve the API key for the merge videos with BYOK
  videoUrls: string[];
  targetFps?: number;
  resolution?: { width: number; height: number };
}): Promise<MergeVideosResult> {
  if (videoUrls.length === 0) {
    throw new Error('At least one video URL is required');
  }

  console.log(`[Merge Videos] Merging ${videoUrls.length} videos`, {
    targetFps,
    resolution,
  });

  const falApiKeyInfo = await apiKeyService.resolveKey('fal', teamId);
  const falApiKey = falApiKeyInfo.key;
  const adapter = falVideo(MERGE_VIDEOS_MODEL_ID, {
    apiKey: falApiKey,
  });

  // prompt is unused by the ffmpeg endpoint; parameters go via modelOptions
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
          usedOwnKey: falApiKeyInfo.source === 'team',
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
