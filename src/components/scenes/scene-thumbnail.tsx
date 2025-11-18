import { Skeleton } from '@/components/ui/skeleton';
import {
  type AspectRatio,
  getAspectRatioClassName,
} from '@/lib/constants/aspect-ratios';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { memo } from 'react';

type SceneThumbnailProps = {
  thumbnailUrl?: string | null;
  thumbnailStatus?: 'pending' | 'generating' | 'completed' | 'failed';
  alt: string;
  aspectRatio: AspectRatio;
  className?: string;
};

const SceneThumbnailComponent: React.FC<SceneThumbnailProps> = ({
  thumbnailUrl,
  thumbnailStatus = 'pending',
  alt,
  aspectRatio,
  className,
}) => {
  // Show skeleton only when there's no image yet (initial loading)
  const isInitialLoading =
    (thumbnailStatus === 'pending' || thumbnailStatus === 'generating') &&
    !thumbnailUrl;
  // Show loading overlay when regenerating an existing image
  const isRegenerating = thumbnailStatus === 'generating' && thumbnailUrl;
  const isFailed = thumbnailStatus === 'failed';
  // Show image if we have a URL and it's either completed or being regenerated
  const hasImage =
    thumbnailUrl &&
    (thumbnailStatus === 'completed' || thumbnailStatus === 'generating');

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        getAspectRatioClassName(aspectRatio),
        className
      )}
    >
      {isInitialLoading && (
        <Skeleton className="absolute h-full w-full rounded-md" />
      )}

      {hasImage && (
        <>
          <Image
            src={thumbnailUrl}
            alt={alt}
            className="h-full w-full object-cover"
            width={320}
            height={180}
          />
          {isRegenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <Skeleton className="h-full w-full rounded-md opacity-50" />
            </div>
          )}
        </>
      )}

      {isFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
            <span className="text-xs">Failed to generate</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Custom equality check to prevent unnecessary re-renders during polling
// Only re-render when thumbnail-related fields actually change
const areEqual = (
  prevProps: SceneThumbnailProps,
  nextProps: SceneThumbnailProps
): boolean => {
  return (
    prevProps.thumbnailUrl === nextProps.thumbnailUrl &&
    prevProps.thumbnailStatus === nextProps.thumbnailStatus &&
    prevProps.alt === nextProps.alt &&
    prevProps.aspectRatio === nextProps.aspectRatio &&
    prevProps.className === nextProps.className
  );
};

export const SceneThumbnail = memo(SceneThumbnailComponent, areEqual);
