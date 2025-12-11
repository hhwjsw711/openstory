'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import type { Frame } from '@/types/database';
import { Loader2, Video } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { SceneListItem } from './scene-list-item';

type SceneListProps = {
  frames?: Frame[] | undefined;
  selectedFrameId?: string;
  aspectRatio: AspectRatio;
  onSelectFrame: (frameId: string) => void;
  regeneratingImages: Set<string>;
  regeneratingMotion: Set<string>;
  onBatchGenerateMotion?: (frameIds: string[]) => Promise<void>;
};

const isCompleted = (frame: Frame) => {
  const isFullyGenerated =
    frame.thumbnailStatus === 'completed' && frame.videoStatus === 'completed';
  return isFullyGenerated;
};

const SceneListComponent: React.FC<SceneListProps> = ({
  frames,
  selectedFrameId,
  aspectRatio,
  onSelectFrame,
  regeneratingImages,
  regeneratingMotion,
  onBatchGenerateMotion,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculate eligible frames for motion generation
  // Include pending, failed, and generating frames that have completed thumbnails
  // 'generating' is included to allow retrying stuck jobs
  const eligibleFrames = useMemo(() => {
    if (!frames) return [];
    return frames.filter(
      (f) =>
        (f.videoStatus === 'pending' ||
          f.videoStatus === 'failed' ||
          f.videoStatus === 'generating') &&
        f.thumbnailStatus === 'completed'
    );
  }, [frames]);

  const handleGenerateMotion = async () => {
    if (!onBatchGenerateMotion || eligibleFrames.length === 0) return;

    setIsGenerating(true);
    try {
      await onBatchGenerateMotion(eligibleFrames.map((f) => f.id));
    } finally {
      setIsGenerating(false);
    }
  };

  const hasEligibleFrames = eligibleFrames.length > 0;
  const isMotionInProgress = regeneratingMotion.size > 0;

  return (
    <div className="flex h-full w-80 flex-col border-r bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Scenes
        </h2>
      </div>

      {/* Scene list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-3 p-4">
          {(frames === undefined || frames.length === 0) &&
            [1, 2, 3].map((i) => (
              <SceneListItem
                key={`frame-skeleton-${i}`}
                frame={undefined}
                aspectRatio={aspectRatio}
                isActive={false}
                isCompleted={false}
                onSelect={function (): void {
                  throw new Error('Function not implemented.');
                }}
              />
            ))}

          {frames &&
            frames.map((frame) => (
              <SceneListItem
                key={frame.id}
                frame={frame}
                aspectRatio={aspectRatio}
                isActive={frame.id === selectedFrameId}
                isCompleted={isCompleted(frame)}
                onSelect={() => onSelectFrame(frame.id)}
                isRegeneratingImage={regeneratingImages.has(frame.id)}
                isRegeneratingMotion={regeneratingMotion.has(frame.id)}
              />
            ))}
        </div>
      </ScrollArea>

      {/* Sticky footer with Generate Motion button */}
      {hasEligibleFrames && (
        <div className="sticky bottom-0 border-t bg-background p-4">
          <Button
            variant="default"
            className="w-full"
            onClick={handleGenerateMotion}
            disabled={isGenerating || isMotionInProgress}
          >
            {isGenerating || isMotionInProgress ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Video className="mr-2 h-4 w-4" />
                Generate Motion ({eligibleFrames.length}{' '}
                {eligibleFrames.length === 1 ? 'frame' : 'frames'})
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

// Custom equality check to prevent unnecessary re-renders during polling
// Relies on TanStack Query's structural sharing to preserve frame object references
const areEqual = (
  prevProps: SceneListProps,
  nextProps: SceneListProps
): boolean => {
  // Compare primitive props
  if (
    prevProps.selectedFrameId !== nextProps.selectedFrameId ||
    prevProps.aspectRatio !== nextProps.aspectRatio
  ) {
    return false;
  }

  // Compare regenerating Sets by reference (parent creates new Set on change)
  if (
    prevProps.regeneratingImages !== nextProps.regeneratingImages ||
    prevProps.regeneratingMotion !== nextProps.regeneratingMotion
  ) {
    return false;
  }

  // Compare callback references
  if (prevProps.onBatchGenerateMotion !== nextProps.onBatchGenerateMotion) {
    return false;
  }

  // Compare frames array
  // TanStack Query's structural sharing should maintain the same array reference
  // if the content hasn't changed, so reference equality check is sufficient
  if (prevProps.frames === nextProps.frames) {
    return true;
  }

  // If one is undefined and the other isn't, they're not equal
  if (!prevProps.frames || !nextProps.frames) {
    return false;
  }

  // If array lengths differ, they're not equal
  if (prevProps.frames.length !== nextProps.frames.length) {
    return false;
  }

  // Check if frame object references have changed (structural sharing preserves refs)
  for (let i = 0; i < prevProps.frames.length; i++) {
    if (prevProps.frames[i] !== nextProps.frames[i]) {
      return false;
    }
  }

  return true;
};

export const SceneList = memo(SceneListComponent, areEqual);
