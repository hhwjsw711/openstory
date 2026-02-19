import { PlatesLoaderContainer } from '@/components/ui/plates-loader';
import {
  type AspectRatio,
  getAspectRatioClassName,
} from '@/lib/constants/aspect-ratios';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Image } from '@unpic/react';
import { memo } from 'react';

type SceneThumbnailProps = {
  thumbnailUrl?: string | null;
  /** Whether an image workflow is currently active (from QStash live status) */
  isGenerating?: boolean;
  alt: string;
  aspectRatio: AspectRatio;
  className?: string;
};

const SceneThumbnailComponent: React.FC<SceneThumbnailProps> = ({
  thumbnailUrl,
  isGenerating = false,
  alt,
  aspectRatio,
  className,
}) => {
  // Show loader when generating and no image yet
  const showLoader = !thumbnailUrl && isGenerating;
  // Show skeleton when no image and not generating
  const showSkeleton = !thumbnailUrl && !isGenerating;

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
        <PlatesLoaderContainer size="sm" className="absolute inset-0" />
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
    </div>
  );
};

// Custom equality check to prevent unnecessary re-renders
const areEqual = (
  prevProps: SceneThumbnailProps,
  nextProps: SceneThumbnailProps
): boolean => {
  return (
    prevProps.thumbnailUrl === nextProps.thumbnailUrl &&
    prevProps.isGenerating === nextProps.isGenerating &&
    prevProps.alt === nextProps.alt &&
    prevProps.aspectRatio === nextProps.aspectRatio &&
    prevProps.className === nextProps.className
  );
};

export const SceneThumbnail = memo(SceneThumbnailComponent, areEqual);
