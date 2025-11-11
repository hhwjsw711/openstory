'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import type { Frame } from '@/types/database';
import { SceneListItem } from './scene-list-item';

type SceneListProps = {
  frames?: Frame[] | undefined;
  selectedFrameId?: string;
  aspectRatio: AspectRatio;
  onSelectFrame: (frameId: string) => void;
};

const isCompleted = (frame: Frame) => {
  const isFullyGenerated =
    frame.thumbnailStatus === 'completed' && frame.videoStatus === 'completed';
  return isFullyGenerated;
};

export const SceneList: React.FC<SceneListProps> = ({
  frames,
  selectedFrameId,
  aspectRatio,
  onSelectFrame,
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
              />
            ))}
        </div>
      </ScrollArea>
    </div>
  );
};
