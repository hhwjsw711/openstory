import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import Image from 'next/image';

type SceneThumbnailProps = {
  thumbnailUrl?: string | null;
  thumbnailStatus?: 'pending' | 'generating' | 'completed' | 'failed';
  alt: string;
  className?: string;
};

export const SceneThumbnail: React.FC<SceneThumbnailProps> = ({
  thumbnailUrl,
  thumbnailStatus = 'pending',
  alt,
  className,
}) => {
  const isLoading =
    thumbnailStatus === 'pending' || thumbnailStatus === 'generating';
  const isFailed = thumbnailStatus === 'failed';
  const hasImage = thumbnailUrl && thumbnailStatus === 'completed';

  return (
    <div className={cn('relative aspect-video overflow-hidden', className)}>
      {isLoading && <Skeleton className="absolute h-full w-full rounded-md" />}

      {hasImage && (
        <Image
          src={thumbnailUrl}
          alt={alt}
          className="h-full w-full object-cover"
          width={320}
          height={180}
        />
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
