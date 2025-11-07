'use client';

import { cn } from '@/lib/utils';
import type { Frame } from '@/types/database';
import { VideoPlayer } from './video-player';
import { VideoStateOverlay } from './video-state-overlay';
import { useMemo, useState, useCallback } from 'react';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import Image from 'next/image';

type ScenePlayerProps = {
  sequenceId: string;
  frames: Frame[];
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
};

export const ScenePlayer: React.FC<ScenePlayerProps> = ({
  frames,
  className,
  onTimeUpdate,
  onEnded,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  // Filter frames with completed thumbnails (skip frames without thumbnails)
  const displayFrames = useMemo(() => {
    return frames.filter((frame) => frame.thumbnailStatus === 'completed');
  }, [frames]);

  // Get current frame and next frame
  const currentFrame = displayFrames[currentIndex];
  const nextFrame = displayFrames[currentIndex + 1];

  // Handle video end - move to next frame or call onEnded
  const handleEnded = useCallback(() => {
    if (currentIndex < displayFrames.length - 1) {
      setShouldAutoPlay(true); // Enable autoplay for next video
      setCurrentIndex((prev) => prev + 1);
    } else {
      onEnded?.();
    }
  }, [currentIndex, displayFrames.length, onEnded]);

  if (!currentFrame) {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <div className="rounded-lg border border-muted bg-muted/10 p-4">
          <p className="text-sm text-muted-foreground">No frames available</p>
        </div>
      </div>
    );
  }

  // Check if current frame has a completed video
  const hasCompletedVideo =
    currentFrame.videoStatus === 'completed' && currentFrame.videoUrl;

  return (
    <>
      {hasCompletedVideo ? (
        <VideoPlayer
          key={currentFrame.videoUrl} // Force re-render when video changes
          src={currentFrame.videoUrl!}
          posterSrc={currentFrame.thumbnailUrl}
          className={className}
          autoPlay={shouldAutoPlay}
          onTimeUpdate={onTimeUpdate}
          onEnded={handleEnded}
        />
      ) : (
        <div className={cn('relative aspect-video', className)}>
          {currentFrame.thumbnailUrl && (
            <Image
              src={currentFrame.thumbnailUrl}
              alt="Frame thumbnail"
              fill
              className="object-cover"
            />
          )}
          <VideoStateOverlay
            thumbnailStatus={currentFrame.thumbnailStatus}
            videoStatus={currentFrame.videoStatus}
          />
        </div>
      )}

      {/* Preload next video in background if it's completed */}
      {nextFrame?.videoUrl && nextFrame.videoStatus === 'completed' && (
        <div className="hidden">
          <MediaPlayer
            key={nextFrame.videoUrl}
            src={nextFrame.videoUrl}
            preload="auto"
          >
            <MediaProvider />
          </MediaPlayer>
        </div>
      )}
    </>
  );
};
