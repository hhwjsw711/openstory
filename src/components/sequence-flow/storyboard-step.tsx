import type * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { generateFrames } from "#actions/sequence";
import {
  FrameSkeleton,
  FrameSkeletonGrid,
} from "@/components/sequence/frame-skeleton";
import { StoryboardFrame } from "@/components/sequence/storyboard-frame";
import { SectionHeading } from "@/components/typography";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  useActiveFrameGeneration,
  useFramePreviewStatus,
  useFramesBySequence,
  useReorderFrames,
} from "@/hooks/use-frames";
import { useSequence } from "@/hooks/use-sequences";
import type { Frame } from "@/types/database";

interface StoryboardStepProps {
  sequenceId: string;
  onNext: () => void;
  onPrevious: () => void;
}

export const StoryboardStep: React.FC<StoryboardStepProps> = ({
  sequenceId,
  onNext,
  onPrevious,
}) => {
  // Load the sequence data
  const { data: sequence } = useSequence(sequenceId);

  // Check for active frame generation job
  const { data: activeJob } = useActiveFrameGeneration(sequenceId);
  const isBackgroundGenerating =
    activeJob?.status === "running" || activeJob?.status === "pending";
  const expectedFrameCount = activeJob?.framesProgress?.total || 3;
  const completedFrames = activeJob?.framesProgress?.completed || 0;

  // Load frames with auto-refresh when generating
  const { data: frames = [] } = useFramesBySequence(sequenceId, {
    // Refetch every 2 seconds when frames are being generated
    refetchInterval: isBackgroundGenerating ? 2000 : false,
  });

  // Track preview generation status for all frames
  const framePreviewStatus = useFramePreviewStatus(frames);

  const reorderFrames = useReorderFrames();

  // Local state for generation
  const [generationError, setGenerationError] = useState<string | null>(null);

  const hasFrames = frames.length > 0;
  const styleId = sequence?.style_id;

  const handleGenerateStoryboard = useCallback(async () => {
    if (!sequence?.script || !styleId) return;

    setGenerationError(null);

    try {
      const result = await generateFrames(sequenceId);

      if (result.success && result.frames) {
        setGenerationError(result.error || "Failed to generate storyboard");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unexpected error during generation";

      setGenerationError(errorMessage);
    }
  }, [sequence, styleId, sequenceId]);

  // Frame reordering
  const handleFrameReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newFrames = [...frames];
      const [removed] = newFrames.splice(fromIndex, 1);
      newFrames.splice(toIndex, 0, removed);

      // Create the new order mapping
      const frameOrders = newFrames.map((frame, index) => ({
        id: frame.id,
        order_index: index + 1,
      }));

      // Reorder frames
      reorderFrames.mutate({ sequenceId, frameOrders });
    },
    [frames, reorderFrames, sequenceId],
  );

  // Next button
  const handleNext = useCallback(() => {
    if (hasFrames) {
      onNext();
    }
  }, [hasFrames, onNext]);

  const canGenerate = useMemo(() => {
    return (
      sequence?.script &&
      sequence.script.trim().length >= 10 &&
      styleId &&
      !isBackgroundGenerating
    );
  }, [sequence?.script, styleId, isBackgroundGenerating]);

  const canProceed = hasFrames && !isBackgroundGenerating;

  if (!sequence) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="storyboard-step">
      {/* Header */}
      <div className="space-y-2">
        <SectionHeading>Storyboard</SectionHeading>
        <p className="text-muted-foreground">
          Generate visual frames from your script. Each frame represents a key
          moment in your story.
        </p>
      </div>

      {/* Show skeleton loaders when frames are being generated in background */}
      {isBackgroundGenerating && !hasFrames && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Generating {expectedFrameCount} frames...
            </div>
            {completedFrames > 0 && (
              <div className="text-sm text-muted-foreground">
                {completedFrames} of {expectedFrameCount} completed
              </div>
            )}
          </div>
          <FrameSkeletonGrid count={expectedFrameCount} isGenerating={true} />
        </div>
      )}

      {/* Generated Frames - show even if some are still generating */}
      {(hasFrames || (isBackgroundGenerating && frames.length > 0)) && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {isBackgroundGenerating && frames.length < expectedFrameCount
                ? `${frames.length} of ${expectedFrameCount} frames ready`
                : `${frames.length} frames generated`}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateStoryboard}
              disabled={!canGenerate || isBackgroundGenerating}
              data-testid="regenerate-storyboard-button"
            >
              {isBackgroundGenerating ? "Generating..." : "Regenerate All"}
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Show existing frames */}
            {frames
              .sort((a: Frame, b: Frame) => a.order_index - b.order_index)
              .map((frame: Frame, index: number) => {
                const previewStatus = framePreviewStatus.get(frame.id);
                return (
                  <StoryboardFrame
                    key={frame.id}
                    frame={frame}
                    isGeneratingPreview={previewStatus?.isGenerating || false}
                    onReorder={(frameId: string, newOrder: number) => {
                      const currentIndex = frames.findIndex(
                        (f: Frame) => f.id === frameId,
                      );
                      if (currentIndex !== -1) {
                        handleFrameReorder(currentIndex, newOrder - 1); // Convert to 0-based index
                      }
                    }}
                    data-testid={`storyboard-frame-${index}`}
                  />
                );
              })}

            {/* Show skeleton loaders for frames still being generated */}
            {isBackgroundGenerating &&
              frames.length < expectedFrameCount &&
              Array.from({ length: expectedFrameCount - frames.length }).map(
                (_, index) => (
                  <FrameSkeleton
                    key={`pending-frame-${frames.length + index}`}
                    index={frames.length + index}
                    isGenerating={true}
                  />
                ),
              )}
          </div>

          {generationError && (
            <Alert variant="destructive">
              <div className="space-y-2">
                <div className="font-medium">Generation Error</div>
                <div className="text-sm">{generationError}</div>
              </div>
            </Alert>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onPrevious}
          data-testid="back-to-script-button"
        >
          ← Back to Script
        </Button>

        {hasFrames && (
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            size="lg"
            data-testid="next-to-motion-button"
          >
            Add Motion →
          </Button>
        )}
      </div>
    </div>
  );
};
