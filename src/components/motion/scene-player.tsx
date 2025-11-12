'use client';

import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type AspectRatio,
  getAspectRatioClassName,
} from '@/lib/constants/aspect-ratios';
import { cn } from '@/lib/utils';
import type { Frame } from '@/types/database';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { AlertCircle, VideoIcon } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { VideoPlayer } from './video-player';

type ScenePlayerProps = {
  frames?: Frame[];
  selectedFrameId?: string;
  aspectRatio: AspectRatio;
  onSelectFrame: (frameId: string) => void;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
};

export const ScenePlayer: React.FC<ScenePlayerProps> = ({
  frames,
  className,
  selectedFrameId,
  aspectRatio,
  onSelectFrame,
  onTimeUpdate,
  onEnded,
}) => {
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  // Get current frame and next frame
  const [currentFrameIndex, setCurrentFrameIndex] = useState(
    frames?.findIndex((frame) => frame.id === selectedFrameId) ?? -1
  );
  useEffect(() => {
    // We could use a useMemo here, but we want to support not having to have a callback to set the selected frame id
    setCurrentFrameIndex(
      frames?.findIndex((frame) => frame.id === selectedFrameId) ?? -1
    );
  }, [selectedFrameId, frames]);

  const currentFrame =
    frames && currentFrameIndex >= 0 ? frames[currentFrameIndex] : undefined;
  const nextFrame =
    frames && currentFrameIndex < frames.length - 1
      ? frames.find(
          (frame, index) =>
            frame.videoStatus === 'completed' &&
            frame.videoUrl &&
            index > currentFrameIndex,
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
  }, [nextFrame, onEnded, onSelectFrame]);

  // Show skeleton when frames are loading
  if (!frames || frames.length === 0) {
    return (
      <Skeleton
        className={cn('w-full', getAspectRatioClassName(aspectRatio))}
      />
    );
  }

  if (!currentFrame) {
    return (
      <EmptyState
        icon={<VideoIcon />}
        title={'No selected frame'}
        description={'Please select a frame to play.'}
      />
    );
  }

  // Check video status
  const hasCompletedVideo =
    currentFrame.videoStatus === 'completed' && currentFrame.videoUrl;
  const hasFailedVideo = currentFrame.videoStatus === 'failed';

  // Generate a descriptive filename for download
  const title = currentFrame.metadata?.metadata?.title;
  const sanitizedTitle = title
    ? title
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .substring(0, 100) // Limit length
    : '';
  const downloadFilename =
    sanitizedTitle.length > 0
      ? `${sanitizedTitle}.mp4`
      : `scene-${currentFrame.id}.mp4`;

  return (
    <>
      {hasFailedVideo ? (
        <div
          className={cn(
            'relative overflow-hidden',
            getAspectRatioClassName(aspectRatio),
            // Use bg-muted as fallback when no thumbnail
            !currentFrame.thumbnailUrl && 'bg-muted',
            className
          )}
        >
          {/* Show thumbnail as background if available */}
          {currentFrame.thumbnailUrl && (
            <Image
              src={currentFrame.thumbnailUrl}
              alt={title || 'Scene thumbnail'}
              className="h-full w-full object-cover"
              width={1280}
              height={720}
            />
          )}

          {/* Error overlay */}
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              // Use semi-transparent overlay if thumbnail exists, solid bg if not
              currentFrame.thumbnailUrl ? 'bg-muted/80' : 'bg-transparent'
            )}
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-8 w-8" />
              <span className="text-sm">Failed to generate video</span>
            </div>
          </div>
        </div>
      ) : (
        <VideoPlayer
          key={currentFrame.videoUrl} // Force re-render when video changes
          src={currentFrame.videoUrl || ''}
          posterSrc={currentFrame.thumbnailUrl}
          aspectRatio={aspectRatio}
          className={className}
          autoPlay={shouldAutoPlay}
          enableDownload={!!currentFrame.videoUrl}
          downloadFilename={downloadFilename}
          onTimeUpdate={onTimeUpdate}
          onEnded={handleEnded}
        />
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
