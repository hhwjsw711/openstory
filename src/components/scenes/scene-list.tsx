'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useFramesBySequence } from '@/hooks/use-frames';
import type { Frame } from '@/types/database';
import { Suspense } from 'react';
import { SceneListItem } from './scene-list-item';

type SceneListProps = {
  sequenceId: string;
  selectedFrameId: string | null;
  onSelectFrame: (frameId: string) => void;
  completedFrameIds: Set<string>;
  onToggleComplete: (frameId: string) => void;
};

const SceneListSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-lg border p-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="aspect-video w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      ))}
    </div>
  );
};

const SceneListContent: React.FC<SceneListProps> = ({
  sequenceId,
  selectedFrameId,
  onSelectFrame,
  completedFrameIds,
  onToggleComplete,
}) => {
  const { data: frames = [] } = useFramesBySequence(sequenceId);

  const isCompleted = (frame: Frame) => {
    const isFullyGenerated =
      frame.thumbnailStatus === 'completed' &&
      frame.videoStatus === 'completed';
    const isManuallyMarked = completedFrameIds.has(frame.id);
    return isFullyGenerated || isManuallyMarked;
  };

  if (frames.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">No scenes yet</p>
          <p className="text-xs text-muted-foreground">
            Generate frames from your script to see them here
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-4">
        {frames.map((frame) => (
          <SceneListItem
            key={frame.id}
            frame={frame}
            isActive={frame.id === selectedFrameId}
            isCompleted={isCompleted(frame)}
            onSelect={() => onSelectFrame(frame.id)}
            onToggleComplete={() => onToggleComplete(frame.id)}
          />
        ))}
      </div>
    </ScrollArea>
  );
};

export const SceneList: React.FC<SceneListProps> = (props) => {
  return (
    <div className="flex h-full w-80 flex-col border-r bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Scenes
        </h2>
      </div>

      {/* Scene list with Suspense */}
      <Suspense fallback={<SceneListSkeleton />}>
        <SceneListContent {...props} />
      </Suspense>
    </div>
  );
};
