/**
 * Merge Audio+Video Service
 * Muxes an audio track onto a video using fal.ai's ffmpeg API
 */

import { getEnv } from '#env';
import type { QueueStatus } from '@fal-ai/client';
import { createFalClient } from '@fal-ai/client';

const MERGE_AUDIO_VIDEO_MODEL_ID = 'fal-ai/ffmpeg-api/merge-audio-video';

export type MergeAudioVideoResult = {
  videoUrl: string;
  requestId?: string;
  cost: number;
};

/**
 * Merge an audio track with a video using fal.ai's ffmpeg API
 * The resulting video contains the original video stream with the audio track muxed in
 */
export async function mergeAudioVideo(
  videoUrl: string,
  audioUrl: string,
  falApiKey?: string
): Promise<MergeAudioVideoResult> {
  console.log('[MergeAudioVideo] Muxing audio with video', {
    videoUrl: videoUrl.slice(0, 80),
    audioUrl: audioUrl.slice(0, 80),
  });

  const fal = createFalClient({
    credentials: falApiKey ?? getEnv().FAL_KEY ?? '',
  });

  let requestId: string | undefined;

  const result = await fal.subscribe(MERGE_AUDIO_VIDEO_MODEL_ID, {
    input: {
      video_url: videoUrl,
      audio_url: audioUrl,
    },
    logs: true,
    pollInterval: 5000,
    onEnqueue: (reqId: string) => {
      requestId = reqId;
      console.log(`[MergeAudioVideo] Request enqueued: ${reqId}`);
    },
    onQueueUpdate: (update: QueueStatus) => {
      if (update.status === 'IN_QUEUE' && 'queue_position' in update) {
        console.log(
          `[MergeAudioVideo] Queue position: ${update.queue_position}`
        );
      }
      if (update.status === 'COMPLETED') {
        console.log(
          `[MergeAudioVideo] Completed in ${update.metrics?.inference_time || 'unknown'}s`
        );
      }
    },
  });

  const outputVideoUrl = result.data.video.url;

  if (!outputVideoUrl) {
    throw new Error('No video URL returned from merge-audio-video operation');
  }

  let cost = 0;
  if (
    'metadata' in result &&
    result.metadata &&
    typeof result.metadata === 'object'
  ) {
    const meta = result.metadata;
    if ('cost' in meta && typeof meta.cost === 'number') {
      cost = meta.cost;
    }
  }

  return {
    videoUrl: outputVideoUrl,
    requestId: requestId ?? result.requestId,
    cost,
  };
}
