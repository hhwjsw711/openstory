import { PlatesLoader } from '@/components/ui/plates-loader';
import { cn } from '@/lib/utils';

type VideoStateOverlayProps = {
  thumbnailUrl?: string | null;
  /** Whether a workflow is currently generating this frame (from live QStash status) */
  isGenerating?: boolean;
  className?: string;
};

export const VideoStateOverlay: React.FC<VideoStateOverlayProps> = ({
  thumbnailUrl,
  isGenerating = false,
  className,
}) => {
  // Only show overlay when there's no thumbnail and we're generating
  if (thumbnailUrl || !isGenerating) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center',
        className
      )}
      style={{
        background:
          'radial-gradient(circle at 50% 0%, rgba(249, 115, 22, 0.15), transparent 70%), #09090b',
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <PlatesLoader size="lg" />
        <p className="text-sm font-medium">Generating frame…</p>
      </div>
    </div>
  );
};
