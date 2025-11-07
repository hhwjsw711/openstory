'use client';

import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { Frame } from '@/types/database';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { VideoIcon } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { VideoPlayer } from './video-player';
import { VideoStateOverlay } from './video-state-overlay';

type ScenePlayerProps = {
  frames?: Frame[] | undefined;
  selectedFrameId?: string;
  onSelectFrame: (frameId: string) => void;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
};

export const ScenePlayer: React.FC<ScenePlayerProps> = ({
  frames = [],
  className,
  selectedFrameId,
  onSelectFrame,
  onTimeUpdate,
  onEnded,
}) => {
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  // Filter frames with completed thumbnails (skip frames without thumbnails)
  const displayFrames = useMemo(() => {
    return frames.filter((frame) => frame.thumbnailStatus === 'completed');
  }, [frames]);

  // Get current frame and next frame
  const [currentFrameIndex, setCurrentFrameIndex] = useState(
    frames.findIndex((frame) => frame.id === selectedFrameId)
  );
  useEffect(() => {
    // We could use a useMemo here, but we want to support not having to have a callback to set the selected frame id
    setCurrentFrameIndex(
      frames.findIndex((frame) => frame.id === selectedFrameId)
    );
  }, [selectedFrameId, frames]);

  const currentFrame =
    currentFrameIndex >= 0 ? frames[currentFrameIndex] : undefined;
  const nextFrame =
    currentFrameIndex < frames.length - 1
      ? frames.find(
          (frame) => frame.videoStatus === 'completed' && frame.videoUrl,
          currentFrameIndex + 1
        )
      : undefined;

  // Handle video end - move to next frame or call onEnded
  const handleEnded = useCallback(() => {
    if (nextFrame) {
      setShouldAutoPlay(true); // Enable autoplay for next video
      // Select the next frame - not this may cause a re-render of the scene list
      onSelectFrame(nextFrame.id);
    } else {
      onEnded?.();
    }
  }, [currentFrameIndex, displayFrames.length, onEnded, onSelectFrame]);

  if (!currentFrame) {
    return (
      <EmptyState
        icon={<VideoIcon />}
        title={'No selected frame'}
        description={'Please select a frame to play.'}
      />
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
