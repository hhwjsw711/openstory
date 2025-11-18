'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import type { Frame } from '@/types/database';
import { memo } from 'react';
import { SceneListItem } from './scene-list-item';

type SceneListProps = {
  frames?: Frame[] | undefined;
  selectedFrameId?: string;
  aspectRatio: AspectRatio;
  onSelectFrame: (frameId: string) => void;
  regeneratingImages: Set<string>;
  regeneratingMotion: Set<string>;
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
}) => {
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
