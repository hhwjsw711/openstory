/**
 * RemotionSequencePlayer - Replaces ScenePlayer with a Remotion-powered
 * composition that plays all frames as a unified timeline.
 *
 * Supports:
 * - Playing through all frames in sequence
 * - Seeking to a specific frame by ID
 * - Crossfade transitions between frames
 * - Reactive updates when frame data changes (new images/videos generated)
 * - Loading / empty states matching existing UX
 */

import { BlobLoader } from '@/components/ui/blob-loader';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type AspectRatio,
  getAspectRatioClassName,
} from '@/lib/constants/aspect-ratios';
import { cn } from '@/lib/utils';
import { SequenceComposition } from '@/remotion/compositions/sequence-composition';
import {
  COMPOSITION_DIMENSIONS,
  COMPOSITION_FPS,
  TRANSITION_DURATION_FRAMES,
  getFrameStartInComposition,
  getTotalDurationInFrames,
  type RemotionFrameData,
  type TransitionType,
} from '@/remotion/types';
import type { Frame } from '@/types/database';
import { Player, type PlayerRef } from '@remotion/player';
import { Loader2, VideoIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

type RemotionSequencePlayerProps = {
  frames?: Frame[];
  selectedFrameId?: string;
  aspectRatio: AspectRatio;
  onSelectFrame: (frameId: string) => void;
  className?: string;
  progressMessage?: string;
  transition?: TransitionType;
  /** Ref for external control (seekToFrame, play, pause) */
  playerRef?: React.Ref<RemotionSequencePlayerHandle>;
};

export type RemotionSequencePlayerHandle = {
  seekToFrame: (frameId: string) => void;
  play: () => void;
  pause: () => void;
};

/** Map DB Frame to the minimal shape Remotion compositions need */
function toRemotionFrame(frame: Frame): RemotionFrameData {
  return {
    id: frame.id,
    orderIndex: frame.orderIndex,
    thumbnailUrl: frame.thumbnailUrl,
    videoUrl: frame.videoUrl,
    videoStatus: frame.videoStatus,
    durationMs: frame.durationMs,
    metadata: frame.metadata
      ? {
          metadata: frame.metadata.metadata
            ? { title: frame.metadata.metadata.title }
            : undefined,
          sceneNumber: frame.metadata.sceneNumber,
        }
      : null,
  };
}

export const RemotionSequencePlayer: React.FC<RemotionSequencePlayerProps> = ({
  frames,
  selectedFrameId,
  aspectRatio,
  onSelectFrame,
  className,
  progressMessage,
  transition = 'none',
  playerRef: externalRef,
}) => {
  const internalRef = useRef<PlayerRef>(null);

  const remotionFrames = useMemo(
    () => (frames ?? []).map(toRemotionFrame),
    [frames]
  );

  const dimensions = COMPOSITION_DIMENSIONS[aspectRatio];
  const fps = COMPOSITION_FPS;
  const totalDuration = useMemo(
    () => getTotalDurationInFrames(remotionFrames, fps, transition),
    [remotionFrames, fps, transition]
  );

  // Memoize inputProps to avoid unnecessary Player re-renders
  const inputProps = useMemo(
    () => ({ frames: remotionFrames, transition }),
    [remotionFrames, transition]
  );

  // Seek to selected frame when it changes externally
  const seekToFrame = useCallback(
    (frameId: string) => {
      const index = remotionFrames.findIndex((f) => f.id === frameId);
      if (index < 0 || !internalRef.current) return;

      const startFrame = getFrameStartInComposition(
        remotionFrames,
        index,
        fps,
        transition
      );
      internalRef.current.seekTo(startFrame);
    },
    [remotionFrames, fps, transition]
  );

  // Expose control handle
  useImperativeHandle(
    externalRef,
    () => ({
      seekToFrame,
      play: () => internalRef.current?.play(),
      pause: () => internalRef.current?.pause(),
    }),
    [seekToFrame]
  );

  // Seek when selectedFrameId changes (e.g. user clicks in SceneList)
  useEffect(() => {
    if (selectedFrameId) {
      seekToFrame(selectedFrameId);
    }
  }, [selectedFrameId, seekToFrame]);

  // Subscribe to frameupdate events on the Player ref to track which frame is active
  useEffect(() => {
    const player = internalRef.current;
    if (!player || remotionFrames.length === 0) return;

    const overlap =
      transition === 'crossfade' && remotionFrames.length > 1
        ? TRANSITION_DURATION_FRAMES
        : 0;

    const handler = (event: { detail: { frame: number } }) => {
      const currentRenderFrame = event.detail.frame;
      let accumulated = 0;

      for (const rf of remotionFrames) {
        const duration = Math.round(((rf.durationMs ?? 5000) / 1000) * fps);
        if (currentRenderFrame < accumulated + duration) {
          if (rf.id !== selectedFrameId) {
            onSelectFrame(rf.id);
          }
          break;
        }
        accumulated += duration - overlap;
      }
    };

    player.addEventListener('frameupdate', handler);
    return () => player.removeEventListener('frameupdate', handler);
  }, [remotionFrames, fps, transition, selectedFrameId, onSelectFrame]);

  // Show blob loader during initial generation (no frames yet)
  if (!frames || frames.length === 0) {
    if (progressMessage) {
      return (
        <div
          className={cn(
            'relative flex w-full items-center justify-center overflow-hidden bg-muted',
            className,
            getAspectRatioClassName(aspectRatio)
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(167,112,239,0.12),transparent_70%)]" />
          <div className="flex flex-col items-center gap-4">
            <BlobLoader size="lg" />
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium">{progressMessage}</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={cn(className, getAspectRatioClassName(aspectRatio))}>
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (remotionFrames.length === 0) {
    return (
      <EmptyState
        icon={<VideoIcon />}
        title="No frames"
        description="Analyze a script to generate frames."
      />
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <Player
        ref={internalRef}
        component={SequenceComposition}
        inputProps={inputProps}
        durationInFrames={totalDuration}
        fps={fps}
        compositionWidth={dimensions.width}
        compositionHeight={dimensions.height}
        style={{ width: '100%' }}
        controls
        autoPlay={false}
        loop={false}
      />
    </div>
  );
};
