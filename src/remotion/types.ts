/**
 * Remotion composition input types.
 * Maps from the database Frame model to what Remotion compositions need.
 */

import type { AspectRatio } from '@/lib/constants/aspect-ratios';

export type TransitionType = 'none' | 'crossfade';

export type RemotionFrameData = {
  id: string;
  orderIndex: number;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  videoStatus: string | null;
  durationMs: number | null;
  metadata: {
    metadata?: { title?: string };
    sceneNumber?: number;
  } | null;
};

export type SequenceCompositionProps = {
  frames: RemotionFrameData[];
  transition: TransitionType;
};

/**
 * Aspect ratio to Remotion composition dimensions.
 * These are the render dimensions (not display size).
 */
export const COMPOSITION_DIMENSIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

/** Default FPS for the Remotion composition */
export const COMPOSITION_FPS = 30;

/** Default frame duration when not specified */
const DEFAULT_FRAME_DURATION_MS = 5000;

/** Duration of crossfade transitions in frames */
export const TRANSITION_DURATION_FRAMES = 15; // 0.5s at 30fps

/** Convert milliseconds to Remotion frame count */
export function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

/** Get the duration in Remotion frames for a given frame data */
export function getFrameDurationInFrames(
  frame: RemotionFrameData,
  fps: number
): number {
  return msToFrames(frame.durationMs ?? DEFAULT_FRAME_DURATION_MS, fps);
}

/**
 * Calculate the total composition duration in Remotion frames.
 * Accounts for transition overlaps between frames.
 */
export function getTotalDurationInFrames(
  frames: RemotionFrameData[],
  fps: number,
  transition: TransitionType
): number {
  if (frames.length === 0) return 1; // Remotion requires at least 1 frame

  let total = 0;
  for (const frame of frames) {
    total += getFrameDurationInFrames(frame, fps);
  }

  // Subtract overlap for crossfade transitions (n-1 transitions)
  if (transition === 'crossfade' && frames.length > 1) {
    total -= TRANSITION_DURATION_FRAMES * (frames.length - 1);
  }

  return Math.max(1, total);
}

/**
 * Calculate the start frame for a given frame index in the composition.
 * Accounts for transition overlaps.
 */
export function getFrameStartInComposition(
  frames: RemotionFrameData[],
  frameIndex: number,
  fps: number,
  transition: TransitionType
): number {
  let start = 0;
  for (let i = 0; i < frameIndex && i < frames.length; i++) {
    const frame = frames[i];
    if (!frame) continue;
    start += getFrameDurationInFrames(frame, fps);
    if (transition === 'crossfade') {
      start -= TRANSITION_DURATION_FRAMES;
    }
  }
  return Math.max(0, start);
}
