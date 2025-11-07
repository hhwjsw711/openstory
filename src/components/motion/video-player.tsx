'use client';

import { cn } from '@/lib/utils';
import {
  MediaPlayer,
  MediaProvider,
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
  className?: string;
  autoPlay?: boolean;
  enableDownload?: boolean;
  downloadFilename?: string;
  onLoadedMetadata?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  chaptersUrl,
  posterSrc,
  className,
  autoPlay = false,
  enableDownload = false,
  downloadFilename,
  onLoadedMetadata,
  onTimeUpdate,
  onEnded,
}) => {
  const playerRef = useRef<MediaPlayerInstance>(null);

  // Construct download info with explicit URL and filename
  const downloadInfo =
    enableDownload && downloadFilename
      ? { url: src, filename: downloadFilename }
      : enableDownload
        ? true
        : null;

  return (
    <MediaPlayer
      ref={playerRef}
      src={src}
      poster={posterSrc || undefined}
      className={cn('w-full aspect-video rounded-lg', className)}
      playsInline
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
      <MediaProvider />
      {chaptersUrl && (
        <Track kind="chapters" src={chaptersUrl} type="vtt" default />
      )}
      <DefaultVideoLayout icons={defaultLayoutIcons} download={downloadInfo} />
    </MediaPlayer>
  );
};
