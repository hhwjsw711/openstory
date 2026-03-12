import { BlobLoaderContainer } from '@/components/ui/blob-loader';
import {
  type AspectRatio,
  getAspectRatioClassName,
} from '@/lib/constants/aspect-ratios';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { Image } from '@unpic/react';
import { memo } from 'react';

type SceneThumbnailProps = {
  thumbnailUrl?: string | null;
  thumbnailStatus?:
    | 'pending'
    | 'preview'
    | 'generating'
    | 'completed'
    | 'failed';
  alt: string;
  aspectRatio: AspectRatio;
  className?: string;
};

const SceneThumbnailComponent: React.FC<SceneThumbnailProps> = ({
  thumbnailUrl,
  thumbnailStatus,
  alt,
  aspectRatio,
  className,
}) => {
  // Only show loader when there's no image
  const showLoader =
    !thumbnailUrl && !!thumbnailStatus && thumbnailStatus !== 'failed';

  const showSkeleton = !thumbnailUrl || !thumbnailStatus;
  const isFailed = thumbnailStatus === 'failed' && !thumbnailUrl;

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        getAspectRatioClassName(aspectRatio),
        className
      )}
    >
      {showSkeleton && (
        <Skeleton className="absolute h-full w-full rounded-md" />
      )}
      {showLoader && (
        <BlobLoaderContainer size="sm" className="absolute inset-0" />
      )}

      {thumbnailUrl && (
        <Image
          src={thumbnailUrl}
          alt={alt}
          className="h-full w-full object-cover"
          width={320}
          height={180}
        />
      )}

      {thumbnailStatus === 'preview' && thumbnailUrl && (
        <span className="absolute top-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
          Preview
        </span>
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
