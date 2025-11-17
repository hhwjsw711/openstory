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
import { CustomDownloadButton } from './custom-download-button';

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
        className={cn(
          'w-full',
          className,
          getAspectRatioClassName(aspectRatio)
        )}
      />
    );
  }

  // Convert aspect ratio format from "16:9" to "16/9" for Vidstack
  const vidstackAspectRatio = aspectRatio.replace(':', '/');

  // Construct download slots
  // Use custom download button when we have a signed URL to avoid vidstack adding query params
  // which would break the AWS signature
  const downloadSlots =
    enableDownload && downloadUrl && downloadFilename
      ? {
          downloadButton: (
            <CustomDownloadButton
              downloadUrl={downloadUrl}
              downloadFilename={downloadFilename}
            />
          ),
        }
      : {};

  // Fallback download info for when downloadUrl is not provided
  // This uses vidstack's default download button (which adds query params)
  const fallbackDownloadInfo =
    enableDownload && !downloadUrl
      ? downloadFilename
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

      <DefaultVideoLayout
        icons={defaultLayoutIcons}
        download={fallbackDownloadInfo}
        slots={downloadSlots}
      />
    </MediaPlayer>
  );
};
