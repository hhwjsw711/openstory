'use client';

import { cn } from '@/lib/utils';
import type { Frame } from '@/types/database';
import { VideoPlayer } from './video-player';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { MediaPlayer, MediaProvider } from '@vidstack/react';

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

  // Filter frames with completed videos
  const videoFrames = useMemo(() => {
    return frames.filter(
      (frame) => frame.videoStatus === 'completed' && frame.videoUrl
    );
  }, [frames]);

  // Get current frame and next frame
  const currentFrame = videoFrames[currentIndex];
  const nextFrame = videoFrames[currentIndex + 1];

  // Handle video end - move to next video or call onEnded
  const handleEnded = useCallback(() => {
    if (currentIndex < videoFrames.length - 1) {
      setShouldAutoPlay(true); // Enable autoplay for next video
      setCurrentIndex((prev) => prev + 1);
    } else {
      onEnded?.();
    }
  }, [currentIndex, videoFrames.length, onEnded]);

  if (!currentFrame) {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <div className="rounded-lg border border-muted bg-muted/10 p-4">
          <p className="text-sm text-muted-foreground">No videos available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <VideoPlayer
        key={currentFrame.videoUrl} // Force re-render when video changes
        src={currentFrame.videoUrl!}
        posterSrc={currentFrame.thumbnailUrl}
        className={className}
        autoPlay={shouldAutoPlay}
        onTimeUpdate={onTimeUpdate}
        onEnded={handleEnded}
      />

      {/* Preload next video in background */}
      {nextFrame?.videoUrl && (
        <MediaPlayer
          key={nextFrame.videoUrl}
          src={nextFrame.videoUrl}
          preload="auto"
          className="hidden"
        >
          <MediaProvider />
        </MediaPlayer>
      )}
    </>
  );
};
