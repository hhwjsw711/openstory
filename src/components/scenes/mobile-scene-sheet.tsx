'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Frame } from '@/types/database';
import { SceneListItem } from './scene-list-item';

type MobileSceneSheetProps = {
  frames: Frame[];
  selectedFrameId: string | null;
  onSelectFrame: (frameId: string) => void;
  completedFrameIds: Set<string>;
  onToggleComplete: (frameId: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export const MobileSceneSheet: React.FC<MobileSceneSheetProps> = ({
  frames,
  selectedFrameId,
  onSelectFrame,
  completedFrameIds,
  onToggleComplete,
  isOpen,
  onOpenChange,
}) => {
  const isCompleted = (frame: Frame) => {
    const isFullyGenerated =
      frame.thumbnailStatus === 'completed' &&
      frame.videoStatus === 'completed';
    const isManuallyMarked = completedFrameIds.has(frame.id);
    return isFullyGenerated || isManuallyMarked;
  };

  const handleSelectFrame = (frameId: string) => {
    onSelectFrame(frameId);
    onOpenChange(false); // Close sheet after selection
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh]">
        <SheetHeader>
          <SheetTitle>
            {frames.length} {frames.length === 1 ? 'Scene' : 'Scenes'}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(70vh-4rem)] mt-4">
          <div className="flex flex-col gap-3 px-1">
            {frames.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-center">
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">No scenes yet</p>
                  <p className="text-xs text-muted-foreground">
                    Generate frames from your script to see them here
                  </p>
                </div>
              </div>
            ) : (
              frames.map((frame) => (
                <SceneListItem
                  key={frame.id}
                  frame={frame}
                  isActive={frame.id === selectedFrameId}
                  isCompleted={isCompleted(frame)}
                  onSelect={() => handleSelectFrame(frame.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
