'use client';

import { cn } from '@/lib/utils';
import {
  MediaPlayer,
  MediaProvider,
  useMediaRemote,
  useMediaStore,
} from '@vidstack/react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { MediaPlayerInstance } from '@vidstack/react';

export type VidstackPlayerProps = {
  src?: string | null;
  posterSrc?: string | null;
  isPlaying?: boolean;
  onEnded?: () => void;
  onLoadedMetadata?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
};

export type VidstackPlayerRef = {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
};

const VidstackPlayerInner = forwardRef<VidstackPlayerRef, VidstackPlayerProps>(
  (
    {
      src,
      posterSrc,
      isPlaying = false,
      onEnded,
      onLoadedMetadata,
      onTimeUpdate,
      className,
    },
    ref
  ) => {
    const playerRef = useRef<MediaPlayerInstance>(null);
    const remote = useMediaRemote(playerRef);
    const state = useMediaStore(playerRef);

    // Access state properties
    const currentTime = state.currentTime;
    const duration = state.duration;
    const ended = state.ended;

    // Expose imperative API
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          remote.play();
        },
        pause: () => {
          remote.pause();
        },
        seek: (time: number) => {
          remote.seek(time);
        },
        getCurrentTime: () => {
          return state.currentTime;
        },
        getDuration: () => {
          return state.duration;
        },
      }),
      [remote, state]
    );

    // Control playback based on isPlaying prop
    useEffect(() => {
      if (!src) return;

      if (isPlaying) {
        remote.play();
      } else {
        remote.pause();
      }
    }, [isPlaying, remote, src]);

    // Forward time updates to parent
    useEffect(() => {
      if (onTimeUpdate) {
        onTimeUpdate(currentTime);
      }
    }, [currentTime, onTimeUpdate]);

    // Forward duration to parent on metadata load
    useEffect(() => {
      if (duration > 0 && onLoadedMetadata) {
        onLoadedMetadata(duration);
      }
    }, [duration, onLoadedMetadata]);

    // Forward ended event to parent
    useEffect(() => {
      if (ended && onEnded) {
        onEnded();
      }
    }, [ended, onEnded]);

    if (!src) {
      return null;
    }

    return (
      <MediaPlayer
        ref={playerRef}
        src={src}
        poster={posterSrc || undefined}
        className={cn('w-full aspect-video rounded-lg', className)}
        muted
        loop
        playsInline
      >
        <MediaProvider />
      </MediaPlayer>
    );
  }
);

VidstackPlayerInner.displayName = 'VidstackPlayer';

export const VidstackPlayer = VidstackPlayerInner;
