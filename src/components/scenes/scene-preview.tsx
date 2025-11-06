'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Frame } from '@/types/database';
import Image from 'next/image';
import { VidstackPlayer, type VidstackPlayerRef } from './vidstack-player';

type ScenePreviewProps = {
  frame: Frame | null;
  className?: string;
  isPlaying?: boolean;
  onEnded?: () => void;
  onLoadedMetadata?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  videoRef?: React.RefObject<VidstackPlayerRef | null>;
};

export const ScenePreview: React.FC<ScenePreviewProps> = ({
  frame,
  className,
  isPlaying = false,
  onEnded,
  onLoadedMetadata,
  onTimeUpdate,
  videoRef,
}) => {
  const hasVideo = frame?.videoUrl && frame.videoStatus === 'completed';
  const hasThumbnail = frame?.thumbnailUrl;

  return (
    <div className={cn('relative w-full max-w-3xl mx-auto', className)}>
      {frame ? (
        hasVideo ? (
          <VidstackPlayer
            ref={videoRef}
            src={frame.videoUrl}
            posterSrc={frame.thumbnailUrl}
            isPlaying={isPlaying}
            onEnded={onEnded}
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={onTimeUpdate}
            className="object-cover"
          />
        ) : hasThumbnail ? (
          <Image
            src={frame.thumbnailUrl || ''}
            alt="Scene"
            className="w-full aspect-video rounded-lg object-cover"
            width={1280}
            height={720}
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
