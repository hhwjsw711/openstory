'use client';

import { Skeleton } from '@/components/ui/skeleton';
import {
  getAspectRatioClassName,
  type AspectRatio,
} from '@/lib/constants/aspect-ratios';
import { cn } from '@/lib/utils';
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaPlayerInstance,
} from '@vidstack/react';
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import { useRef } from 'react';

export type VideoPlayerProps = {
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
  onEnded?: () => void;
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
  onEnded,
}) => {
  const playerRef = useRef<MediaPlayerInstance>(null);

  // Show skeleton when there's no video source and no poster
  if (!src && !posterSrc) {
    return (
      <Skeleton
        className={cn('w-full', getAspectRatioClassName(aspectRatio))}
      />
    );
  }

  // Convert aspect ratio format from "16:9" to "16/9" for Vidstack
  const vidstackAspectRatio = aspectRatio.replace(':', '/');

  // Construct download info
  // If downloadUrl is provided, use it (it has Content-Disposition embedded via AWS ResponseContentDisposition)
  // The filename in Content-Disposition will be used by the browser, but Vidstack still requires
  // a filename parameter in the object. We provide a dummy filename that won't be used.
  // Otherwise fall back to the old behavior with src + filename
  const downloadInfo = enableDownload
    ? downloadUrl
      ? { url: downloadUrl, filename: 'video.mp4' } // Dummy filename, actual comes from Content-Disposition header
      : downloadFilename
        ? { url: src, filename: downloadFilename }
        : true
    : null;

  return (
    <MediaPlayer
      ref={playerRef}
      src={src}
      poster={posterSrc || undefined}
      aspectRatio={vidstackAspectRatio}
      className={className}
      playsInline
      load="visible"
      posterLoad="visible"
      autoPlay={autoPlay}
      onLoadedMetadata={() => {
        if (onLoadedMetadata && playerRef.current) {
          onLoadedMetadata(playerRef.current.state.duration);
        }
      }}
      onTimeUpdate={() => {
        if (onTimeUpdate && playerRef.current) {
          onTimeUpdate(playerRef.current.state.currentTime);
        }
      }}
      onEnded={() => {
        if (onEnded) {
          onEnded();
        }
      }}
    >
      <MediaProvider>
        {/* Show poster if there is no video source and a poster source is provided. Still not 100% sure if this is the best way to do this. */}
        {posterSrc && !src && <Poster src={posterSrc} alt="video thumbnail" />}
      </MediaProvider>

      {chaptersUrl && (
        <Track kind="chapters" src={chaptersUrl} type="vtt" default />
      )}

      <DefaultVideoLayout icons={defaultLayoutIcons} download={downloadInfo} />
    </MediaPlayer>
  );
};
