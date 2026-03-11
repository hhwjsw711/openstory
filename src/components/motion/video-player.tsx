import { Skeleton } from '@/components/ui/skeleton';
import {
  getAspectRatioClassName,
  type AspectRatio,
} from '@/lib/constants/aspect-ratios';
import { cn } from '@/lib/utils';
import { createPlayer, Poster, useMedia } from '@videojs/react';
import { Video, VideoSkin, videoFeatures } from '@videojs/react/video';
import { useEffect, useRef } from 'react';
import { DownloadButton } from './download-button';

const Player = createPlayer({ features: videoFeatures });

type VideoPlayerProps = {
  src: string;
  chaptersUrl?: string;
  posterSrc?: string | null;
  aspectRatio: AspectRatio;
  className?: string;
  autoPlay?: boolean;
  enableDownload?: boolean;
  downloadFilename?: string;
  downloadUrl?: string;
  onLoadedMetadata?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onPause?: () => void;
  onEnded?: () => void;
};

const VideoPlayerInner: React.FC<
  Omit<VideoPlayerProps, 'aspectRatio' | 'className'>
> = ({
  src,
  chaptersUrl,
  posterSrc,
  autoPlay = false,
  enableDownload = false,
  downloadFilename,
  downloadUrl,
  onLoadedMetadata,
  onTimeUpdate,
  onPause,
  onEnded,
}) => {
  const media = useMedia();
  const callbacksRef = useRef({
    onLoadedMetadata,
    onTimeUpdate,
    onPause,
    onEnded,
  });
  callbacksRef.current = { onLoadedMetadata, onTimeUpdate, onPause, onEnded };

  useEffect(() => {
    if (!media) return;
    const el = media;

    const handleLoadedMetadata = () => {
      callbacksRef.current.onLoadedMetadata?.(el.duration);
    };
    const handleTimeUpdate = () => {
      callbacksRef.current.onTimeUpdate?.(el.currentTime);
    };
    const handlePause = () => {
      callbacksRef.current.onPause?.();
    };
    const handleEnded = () => {
      callbacksRef.current.onEnded?.();
    };

    el.addEventListener('loadedmetadata', handleLoadedMetadata);
    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('pause', handlePause);
    el.addEventListener('ended', handleEnded);

    return () => {
      el.removeEventListener('loadedmetadata', handleLoadedMetadata);
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('pause', handlePause);
      el.removeEventListener('ended', handleEnded);
    };
  }, [media]);

  return (
    <VideoSkin>
      <Video
        src={src || undefined}
        playsInline
        autoPlay={autoPlay}
        preload="metadata"
      >
        {chaptersUrl && <track kind="chapters" src={chaptersUrl} default />}
      </Video>
      {posterSrc && <Poster src={posterSrc} alt="Video thumbnail" />}
      {enableDownload && downloadUrl && downloadFilename && (
        <DownloadButton
          downloadUrl={downloadUrl}
          downloadFilename={downloadFilename}
        />
      )}
    </VideoSkin>
  );
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  chaptersUrl,
  posterSrc,
  aspectRatio,
  className,
  autoPlay = false,
  enableDownload = false,
  downloadFilename,
  downloadUrl,
  onLoadedMetadata,
  onTimeUpdate,
  onPause,
  onEnded,
}) => {
  // Show skeleton when there's no video source and no poster
  if (!src && !posterSrc) {
    return (
      <Skeleton
        className={cn(
          'w-full',
          className,
          getAspectRatioClassName(aspectRatio)
        )}
      />
    );
  }

  return (
    <div
      className={cn(className, getAspectRatioClassName(aspectRatio))}
      style={{ position: 'relative' }}
    >
      <Player.Provider>
        <VideoPlayerInner
          src={src}
          chaptersUrl={chaptersUrl}
          posterSrc={posterSrc}
          autoPlay={autoPlay}
          enableDownload={enableDownload}
          downloadFilename={downloadFilename}
          downloadUrl={downloadUrl}
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onPause={onPause}
          onEnded={onEnded}
        />
      </Player.Provider>
    </div>
  );
};
