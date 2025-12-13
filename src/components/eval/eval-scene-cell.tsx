'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { Frame } from '@/types/database';
import { Image } from '@unpic/react';
import type React from 'react';
import { EvalCellDialog } from './eval-cell-dialog';
import type { ViewMode } from './eval-view';

/**
 * Get visual prompt from frame - client-safe utility
 * Prioritizes user-updated prompt over AI-generated prompt
 */
export function getVisualPrompt(frame: Frame): string | null {
  if (frame.imagePrompt) {
    return frame.imagePrompt;
  }
  const scene = frame.metadata;
  return scene?.prompts?.visual?.fullPrompt || null;
}

/**
 * Get original script extract from frame
 */
export function getSceneScript(frame: Frame): string | null {
  const scene = frame.metadata;
  return scene?.originalScript?.extract || null;
}

type EvalSceneCellProps = {
  frame: Frame | undefined;
  viewMode: ViewMode;
  sceneNumber: number;
  sequenceTitle: string;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
};

export const EvalSceneCell: React.FC<EvalSceneCellProps> = ({
  frame,
  viewMode,
  sceneNumber,
  sequenceTitle,
  dialogOpen,
  onDialogOpenChange,
  onNavigateLeft,
  onNavigateRight,
  onNavigateUp,
  onNavigateDown,
}) => {
  // Empty cell for missing frames
  if (!frame) {
    return (
      <div className="border-b p-2 flex items-center justify-center h-full">
        <div className="w-full h-full border-2 border-dashed border-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">
          No scene {sceneNumber}
        </div>
      </div>
    );
  }

  const prompt = getVisualPrompt(frame);
  const script = getSceneScript(frame);

  const handleClick = () => onDialogOpenChange(true);

  // Images view
  if (viewMode === 'images') {
    if (!frame.thumbnailUrl) {
      return (
        <div className="border-b p-2 h-full flex items-center justify-center">
          {frame.thumbnailStatus === 'generating' ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <div className="text-xs text-muted-foreground text-center">
              No image
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        <div
          className="border-b p-2 cursor-pointer hover:bg-muted/50 transition-colors h-full flex flex-col min-h-0 overflow-hidden"
          onClick={handleClick}
        >
          <div className="flex-1 flex items-center min-h-0">
            <Image
              src={frame.thumbnailUrl}
              alt={`Scene ${sceneNumber}`}
              className="w-full h-full object-cover rounded-md"
              loading="lazy"
              width={1000}
              height={1000}
            />
          </div>
        </div>
        <EvalCellDialog
          open={dialogOpen}
          onOpenChange={onDialogOpenChange}
          frame={frame}
          sceneNumber={sceneNumber}
          sequenceTitle={sequenceTitle}
          initialViewMode={viewMode}
          onNavigateLeft={onNavigateLeft}
          onNavigateRight={onNavigateRight}
          onNavigateUp={onNavigateUp}
          onNavigateDown={onNavigateDown}
        />
      </>
    );
  }

  // Script view
  if (viewMode === 'script') {
    if (!script) {
      return (
        <div className="border-b p-2 h-full flex items-center justify-center">
          <div className="text-xs text-muted-foreground">No script</div>
        </div>
      );
    }

    return (
      <>
        <div
          className="border-b p-2 cursor-pointer hover:bg-muted/50 transition-colors h-full flex flex-col min-h-0 overflow-hidden"
          onClick={handleClick}
        >
          <ScrollArea className="flex-1 w-full min-h-0">
            <p className="text-xs leading-relaxed whitespace-pre-wrap pr-2">
              {script}
            </p>
          </ScrollArea>
        </div>
        <EvalCellDialog
          open={dialogOpen}
          onOpenChange={onDialogOpenChange}
          frame={frame}
          sceneNumber={sceneNumber}
          sequenceTitle={sequenceTitle}
          initialViewMode={viewMode}
          onNavigateLeft={onNavigateLeft}
          onNavigateRight={onNavigateRight}
          onNavigateUp={onNavigateUp}
          onNavigateDown={onNavigateDown}
        />
      </>
    );
  }

  // Prompts view (default)
  if (!prompt) {
    return (
      <div className="border-b p-2 h-full flex items-center justify-center">
        <div className="text-xs text-muted-foreground">No prompt</div>
      </div>
    );
  }

  return (
    <>
      <div
        className="border-b p-2 cursor-pointer hover:bg-muted/50 transition-colors h-full flex flex-col min-h-0"
        onClick={handleClick}
      >
        <ScrollArea className="flex-1 w-full min-h-0">
          <p className="text-xs leading-relaxed whitespace-pre-wrap pr-2">
            {prompt}
          </p>
        </ScrollArea>
      </div>
      <EvalCellDialog
        open={dialogOpen}
        onOpenChange={onDialogOpenChange}
        frame={frame}
        sceneNumber={sceneNumber}
        sequenceTitle={sequenceTitle}
        initialViewMode={viewMode}
        onNavigateLeft={onNavigateLeft}
        onNavigateRight={onNavigateRight}
        onNavigateUp={onNavigateUp}
        onNavigateDown={onNavigateDown}
      />
    </>
  );
};
