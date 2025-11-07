import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

type FrameStatus = 'pending' | 'generating' | 'completed' | 'failed' | null;

type VideoStateOverlayProps = {
  thumbnailStatus: FrameStatus;
  videoStatus: FrameStatus;
  className?: string;
};

export const VideoStateOverlay: React.FC<VideoStateOverlayProps> = ({
  thumbnailStatus,
  videoStatus,
  className,
}) => {
  if (videoStatus === 'completed') {
    return null; // No overlay for completed videos
  }

  // Determine what to show based on frame and video status
  const isGeneratingFrame =
    thumbnailStatus === 'pending' || thumbnailStatus === 'generating';
  const isGeneratingVideo =
    !isGeneratingFrame &&
    (videoStatus === 'pending' || videoStatus === 'generating');
  const hasFailed = videoStatus === 'failed';

  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center bg-black/50',
        className
      )}
    >
      <div className="flex flex-col items-center gap-3 rounded-lg bg-background/40 p-6 shadow-lg">
        {!hasFailed && isGeneratingFrame && (
          <>
            <p className="text-sm font-medium">Generating frame…</p>
          </>
        )}

        {!hasFailed && !isGeneratingFrame && isGeneratingVideo && (
          <>
            <p className="text-sm font-medium">Generating video…</p>
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
