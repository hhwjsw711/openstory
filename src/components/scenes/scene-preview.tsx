'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Frame } from '@/types/database';
import Image from 'next/image';
import { useEffect } from 'react';

type ScenePreviewProps = {
  frame: Frame | null;
  className?: string;
  isPlaying?: boolean;
  onEnded?: () => void;
  onLoadedMetadata?: (duration: number) => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
};

export const ScenePreview: React.FC<ScenePreviewProps> = ({
  frame,
  className,
  isPlaying = false,
  onEnded,
  onLoadedMetadata,
  videoRef,
}) => {
  const hasVideo = frame?.videoUrl && frame.videoStatus === 'completed';
  const hasThumbnail = frame?.thumbnailUrl;

  // Reset video when frame changes
  useEffect(() => {
    if (videoRef?.current && hasVideo) {
      videoRef.current.currentTime = 0;
    }
  }, [frame?.id, hasVideo, videoRef]);

  // Control video playback based on isPlaying state
  useEffect(() => {
    if (!videoRef?.current || !hasVideo) return;

    if (isPlaying) {
      videoRef.current.play().catch((error) => {
        console.error('Failed to play video:', error);
      });
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, hasVideo, videoRef]);

  return (
    <div className={cn('relative w-full max-w-3xl mx-auto', className)}>
      {frame ? (
        hasVideo ? (
          <video
            ref={videoRef}
            src={frame.videoUrl || undefined}
            className="w-full aspect-video rounded-lg object-cover"
            muted
            loop
            playsInline
            onEnded={onEnded}
            onLoadedMetadata={(e) => {
              if (onLoadedMetadata) {
                const duration = e.currentTarget.duration;
                // Only call if duration is valid
                if (duration && isFinite(duration)) {
                  onLoadedMetadata(duration);
                }
              }
            }}
          />
        ) : hasThumbnail ? (
          <Image
            src={frame.thumbnailUrl || ''}
            alt="Scene"
            className="w-full aspect-video rounded-lg object-cover"
          />
        ) : (
          <Skeleton className="w-full aspect-video rounded-lg" />
        )
      ) : (
        <Skeleton className="w-full aspect-video rounded-lg" />
      )}
    </div>
  );
};
