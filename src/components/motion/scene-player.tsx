import { type TabValue } from '@/components/scenes/scene-script-prompts';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useFrameDownloadUrl } from '@/hooks/use-frame-download-url';
import {
  type AspectRatio,
  aspectRatioToDimensions,
  getAspectRatioClassName,
} from '@/lib/constants/aspect-ratios';
import { cn } from '@/lib/utils';
import type { Frame } from '@/types/database';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertCircle, Link, Share2, VideoIcon } from 'lucide-react';
import { Image } from '@unpic/react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { VideoPlayer } from './video-player';
import { VideoStateOverlay } from './video-state-overlay';

type ScenePlayerProps = {
  frames?: Frame[];
  selectedFrameId?: string;
  aspectRatio: AspectRatio;
  onSelectFrame: (frameId: string) => void;
  className?: string;
  selectedTab?: TabValue;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
};

export const ScenePlayer: React.FC<ScenePlayerProps> = ({
  frames,
  className,
  selectedFrameId,
  aspectRatio,
  selectedTab,
  onSelectFrame,
  onTimeUpdate,
  onEnded,
}) => {
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  const imageDimensions = aspectRatioToDimensions(aspectRatio);
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

  const handleCopyImageUrl = useCallback(async () => {
    if (!currentFrame?.thumbnailUrl) return;
    try {
      await navigator.clipboard.writeText(currentFrame.thumbnailUrl);
      toast.success('Image URL copied');
    } catch {
      toast.error('Failed to copy URL');
    }
  }, [currentFrame?.thumbnailUrl]);

  const handleCopyVideoUrl = useCallback(async () => {
    if (!currentFrame?.videoUrl) return;
    try {
      await navigator.clipboard.writeText(currentFrame.videoUrl);
      toast.success('Video URL copied');
    } catch {
      toast.error('Failed to copy URL');
    }
  }, [currentFrame?.videoUrl]);

  // Check video status
  const hasCompletedVideo =
    currentFrame &&
    currentFrame.videoStatus === 'completed' &&
    currentFrame.videoUrl;
  const hasFailedVideo = currentFrame && currentFrame.videoStatus === 'failed';

  // Fetch signed download URL with Content-Disposition header (forces browser download)
  const { data: downloadData } = useFrameDownloadUrl(
    { frameId: currentFrame?.id, sequenceId: currentFrame?.sequenceId },
    !!hasCompletedVideo
  );

  // Handle video pause - disable autoplay when user manually pauses
  const handlePause = useCallback(() => {
    setShouldAutoPlay(false);
  }, []);

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
      <div className={cn(className, getAspectRatioClassName(aspectRatio))}>
        <Skeleton className="w-full h-full" />
      </div>
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

  // Get scene title for alt text
  const title = currentFrame.metadata?.metadata?.title;

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
            <a
              href={currentFrame.thumbnailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full h-full"
            >
              <Image
                src={currentFrame.thumbnailUrl}
                alt={title || 'Scene thumbnail'}
                className="w-full h-full object-cover"
                width={imageDimensions.width}
                height={imageDimensions.height}
              />
            </a>
          )}

          {/* Share dropdown */}
          {currentFrame.thumbnailUrl && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10 h-8 w-8 bg-black/50 text-white hover:bg-black/70"
                  aria-label="Share image"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void handleCopyImageUrl()}>
                  <Link className="h-4 w-4" />
                  Copy image URL
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Error overlay */}
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center pointer-events-none',
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
        <div className={cn('relative flex flex-1', className)}>
          {/* Share dropdown */}
          {(currentFrame.thumbnailUrl || currentFrame.videoUrl) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10 h-8 w-8 bg-black/50 text-white hover:bg-black/70"
                  aria-label="Share"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {currentFrame.thumbnailUrl && (
                  <DropdownMenuItem onClick={() => void handleCopyImageUrl()}>
                    <Link className="h-4 w-4" />
                    Copy image URL
                  </DropdownMenuItem>
                )}
                {currentFrame.videoUrl && (
                  <DropdownMenuItem onClick={() => void handleCopyVideoUrl()}>
                    <VideoIcon className="h-4 w-4" />
                    Copy video URL
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Clickable overlay to open image in new tab when poster is showing */}
          {currentFrame.thumbnailUrl &&
            (selectedTab === 'image-prompt' || !currentFrame.videoUrl) && (
              <a
                href={currentFrame.thumbnailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-[5] cursor-pointer"
                aria-label="Open image in new tab"
              />
            )}
          <VideoPlayer
            key={currentFrame.videoUrl} // Force re-render when video changes
            src={
              selectedTab === 'image-prompt' ? '' : currentFrame.videoUrl || ''
            }
            posterSrc={currentFrame.thumbnailUrl}
            aspectRatio={aspectRatio}
            className="w-full h-full"
            autoPlay={shouldAutoPlay}
            enableDownload={!!currentFrame.videoUrl}
            downloadFilename={
              downloadData?.filename || `scene-${currentFrame.id}_velro.mp4`
            }
            downloadUrl={downloadData?.downloadUrl}
            onTimeUpdate={onTimeUpdate}
            onPause={handlePause}
            onEnded={handleEnded}
          />
          {/* Show overlay for image/video generation states */}
          <VideoStateOverlay
            thumbnailUrl={currentFrame.thumbnailUrl}
            videoStatus={currentFrame.videoStatus ?? null}
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
