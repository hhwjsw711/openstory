import { BlobLoader } from '@/components/ui/blob-loader';
import { cn } from '@/lib/utils';
import { AlertCircle, Loader2 } from 'lucide-react';

type FrameStatus = 'pending' | 'generating' | 'completed' | 'failed' | null;

type VideoStateOverlayProps = {
  thumbnailUrl?: string | null;
  videoStatus: FrameStatus;
  className?: string;
  progressMessage?: string;
};

export const VideoStateOverlay: React.FC<VideoStateOverlayProps> = ({
  thumbnailUrl,
  videoStatus,
  className,
  progressMessage,
}) => {
  // Only show loader when there's no thumbnail image yet
  const hasNoThumbnail = !thumbnailUrl;
  const hasFailed = videoStatus === 'failed';

  // Don't show overlay if we have a thumbnail (even if regenerating)
  if (!hasNoThumbnail && !hasFailed) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center',
        className
      )}
      style={{
        background: hasFailed
          ? 'rgba(0, 0, 0, 0.5)'
          : 'radial-gradient(circle at 50% 50%, rgba(167, 112, 239, 0.12), transparent 70%), hsl(var(--muted))',
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {hasNoThumbnail && !hasFailed && (
          <>
            <BlobLoader size="lg" />
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium">
                {progressMessage || 'Generating frame…'}
              </p>
            </div>
          </>
        )}

        {hasFailed && (
          <>
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              Generation failed
            </p>
          </>
        )}
      </div>
    </div>
  );
};
