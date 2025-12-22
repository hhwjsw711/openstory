/**
 * Theatre View
 * Displays the merged video for a sequence
 */

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VideoPlayer } from '@/components/motion/video-player';
import type { Sequence } from '@/types/database';
import { Loader2, AlertCircle, Film } from 'lucide-react';

type TheatreViewProps = {
  sequence: Sequence;
  onGenerateMergedVideo?: () => void;
  isGenerating?: boolean;
};

export const TheatreView: React.FC<TheatreViewProps> = ({
  sequence,
  onGenerateMergedVideo,
  isGenerating = false,
}) => {
  const { mergedVideoStatus, mergedVideoUrl, mergedVideoError, aspectRatio } =
    sequence;

  // Merging state
  if (mergedVideoStatus === 'merging') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Merging video segments...</p>
      </div>
    );
  }

  // Completed state - show video
  if (mergedVideoStatus === 'completed' && mergedVideoUrl) {
    return (
      <div className="flex flex-col gap-4">
        <VideoPlayer
          src={mergedVideoUrl}
          aspectRatio={aspectRatio}
          enableDownload
          downloadFilename={`${sequence.title || 'sequence'}_velro.mp4`}
        />
      </div>
    );
  }

  // Failed state
  if (mergedVideoStatus === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-destructive">Failed to merge video</p>
        {mergedVideoError && (
          <p className="text-sm text-muted-foreground max-w-md text-center">
            {mergedVideoError}
          </p>
        )}
        {onGenerateMergedVideo && (
          <Button onClick={onGenerateMergedVideo} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              'Retry Merge'
            )}
          </Button>
        )}
      </div>
    );
  }

  // Pending state - no merged video yet
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Film className="h-8 w-8 text-muted-foreground" />
      <p className="text-muted-foreground">No merged video yet</p>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        The merged video will be generated automatically once all motion
        segments are complete.
      </p>
      {onGenerateMergedVideo && (
        <Button
          variant="outline"
          onClick={onGenerateMergedVideo}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Now'
          )}
        </Button>
      )}
    </div>
  );
};

export const TheatreViewSkeleton: React.FC = () => (
  <Skeleton className="aspect-video w-full" />
);
