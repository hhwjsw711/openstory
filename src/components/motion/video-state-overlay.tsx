import { PlatesLoader } from '@/components/ui/plates-loader';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

type FrameStatus = 'pending' | 'generating' | 'completed' | 'failed' | null;

type VideoStateOverlayProps = {
  thumbnailUrl?: string | null;
  videoStatus: FrameStatus;
  className?: string;
};

export const VideoStateOverlay: React.FC<VideoStateOverlayProps> = ({
  thumbnailUrl,
  videoStatus,
  className,
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
          : 'radial-gradient(circle at 50% 0%, rgba(249, 115, 22, 0.15), transparent 70%), #09090b',
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {hasNoThumbnail && !hasFailed && (
          <>
            <PlatesLoader size="lg" />
            <p className="text-sm font-medium">Generating frame…</p>
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
