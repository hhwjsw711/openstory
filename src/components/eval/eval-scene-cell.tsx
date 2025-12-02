'use client';

import type React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Frame } from '@/types/database';

/**
 * Get visual prompt from frame - client-safe utility
 * Prioritizes user-updated prompt over AI-generated prompt
 */
function getVisualPrompt(frame: Frame): string | null {
  // Prioritize user-updated prompt
  if (frame.imagePrompt) {
    return frame.imagePrompt;
  }
  // Fall back to AI-generated prompt from scene analysis
  const scene = frame.metadata;
  return scene?.prompts?.visual?.fullPrompt || null;
}

type EvalSceneCellProps = {
  frame: Frame | undefined;
  showImages: boolean;
  sceneNumber: number;
};

export const EvalSceneCell: React.FC<EvalSceneCellProps> = ({
  frame,
  showImages,
  sceneNumber,
}) => {
  // Empty cell for missing frames
  if (!frame) {
    return (
      <div className="border-b p-2 flex items-center justify-center">
        <div className="w-full h-32 border-2 border-dashed border-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">
          No scene {sceneNumber}
        </div>
      </div>
    );
  }

  const prompt = getVisualPrompt(frame);

  if (showImages) {
    // Images view
    if (!frame.thumbnailUrl) {
      return (
        <div className="border-b p-2">
          <div className="w-full h-32 flex items-center justify-center">
            {frame.thumbnailStatus === 'generating' ? (
              <Skeleton className="w-full h-32" />
            ) : (
              <div className="text-xs text-muted-foreground text-center">
                No image
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="border-b p-2">
        <img
          src={frame.thumbnailUrl}
          alt={`Scene ${sceneNumber}`}
          className="w-full h-32 object-cover rounded-md"
          loading="lazy"
        />
      </div>
    );
  }

  // Prompts view
  if (!prompt) {
    return (
      <div className="border-b p-2">
        <div className="w-full h-32 flex items-center justify-center text-xs text-muted-foreground">
          No prompt
        </div>
      </div>
    );
  }

  return (
    <div className="border-b p-2">
      <ScrollArea className="h-32 w-full">
        <p className="text-xs leading-relaxed whitespace-pre-wrap pr-2">
          {prompt}
        </p>
      </ScrollArea>
    </div>
  );
};
