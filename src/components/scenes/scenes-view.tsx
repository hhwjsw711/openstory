import { PhaseIndicatorCompact } from '@/components/generation/phase-indicator';
import { PageContainer } from '@/components/layout/page-container';
import {
  ImageModelBadge,
  ModelBadge,
  VideoModelBadge,
} from '@/components/model/model-badge';
import { SequenceStatusBadge } from '@/components/sequence/sequence-status-badge';
import { ScenePlayer } from '@/components/motion/scene-player';
import { MobileSceneDrawer } from '@/components/scenes/mobile-scene-drawer';
import { SceneList } from '@/components/scenes/scene-list';
import {
  SceneScriptPrompts,
  type TabValue,
} from '@/components/scenes/scene-script-prompts';
import { PageHeader, PageHeading } from '@/components/typography';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFramesBySequence } from '@/hooks/use-frames';
import { useSequence } from '@/hooks/use-sequences';
import {
  DEFAULT_ASPECT_RATIO,
  type AspectRatio,
} from '@/lib/constants/aspect-ratios';
import { useGenerationStream } from '@/lib/realtime/use-generation-stream';
import { batchGenerateMotionFn } from '@/functions/frame-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ScenesViewProps = {
  sequenceId?: string;
};

const getPlayerMaxClassNameByAspectRatio = (
  aspectRatio: AspectRatio
): string => {
  // Use Tailwind arbitrary values - map each aspect ratio to its specific classes
  // Tailwind JIT needs to see the full class names at build time
  const classMap: Record<AspectRatio, string> = {
    '16:9': 'max-h-[50vh] max-w-[calc(50vh*1.7777777777777777)]',
    '9:16': 'max-h-[50vh] max-w-[calc(50vh*0.5625)]',
    '1:1': 'max-h-[50vh] max-w-[50vh]',
  };
  return classMap[aspectRatio] || classMap['16:9'];
};

export const ScenesView: React.FC<ScenesViewProps> = ({ sequenceId }) => {
  // State management
  const [selectedFrameId, setSelectedFrameId] = useState<string | undefined>(
    undefined
  );
  const [selectedTab, setSelectedTab] = useState<TabValue>('script');

  // Track which frames are currently regenerating (UI state)
  const [regeneratingImages, setRegeneratingImages] = useState<Set<string>>(
    new Set()
  );
  const [regeneratingMotion, setRegeneratingMotion] = useState<Set<string>>(
    new Set()
  );

  const [regeneratingSceneVariants, setRegeneratingSceneVariants] = useState<
    Set<string>
  >(new Set());

  // Initial fetch to determine sequence status - disable default polling
  const { data: sequence } = useSequence(sequenceId, {
    refetchInterval: false,
  });
  const aspectRatio = sequence?.aspectRatio || DEFAULT_ASPECT_RATIO;
  const isProcessing = sequence?.status === 'processing';

  // Subscribe to real-time generation events when sequence is processing
  const { state: generationState, status: realtimeStatus } =
    useGenerationStream(sequenceId);

  // Hybrid polling: only poll when processing AND realtime has failed
  // - 'connecting' → wait for connection, don't poll
  // - 'connected' → use realtime, don't poll
  // - 'disconnected'/'error' → poll as fallback
  const realtimeFailed = realtimeStatus === 'error';
  const shouldPoll = isProcessing && realtimeFailed;
  const pollInterval = shouldPoll ? 2000 : false;

  // Fetch sequence and frames with hybrid polling
  const { data: frames } = useFramesBySequence(sequenceId, {
    refetchInterval: pollInterval,
  });

  // Use the most recent sequence data
  const curSelectedFrameId = selectedFrameId || frames?.[0]?.id;
  const selectedFrame = useMemo(
    () => frames?.find((frame) => frame.id === curSelectedFrameId),
    [frames, curSelectedFrameId]
  );

  // Helper functions to manage regeneration state
  const handleRegenerateStart = useCallback(
    (frameId: string, type: 'image' | 'motion' | 'scene-variants') => {
      if (type === 'image') {
        setRegeneratingImages((prev) => new Set(prev).add(frameId));
      } else if (type === 'motion') {
        setRegeneratingMotion((prev) => new Set(prev).add(frameId));
      } else if (type === 'scene-variants') {
        setRegeneratingSceneVariants((prev) => new Set(prev).add(frameId));
      }
    },
    []
  );

  const handleRegenerateEnd = useCallback(
    (frameId: string, type: 'image' | 'motion' | 'scene-variants') => {
      if (type === 'image') {
        setRegeneratingImages((prev) => {
          const next = new Set(prev);
          next.delete(frameId);
          return next;
        });
      } else if (type === 'motion') {
        setRegeneratingMotion((prev) => {
          const next = new Set(prev);
          next.delete(frameId);
          return next;
        });
      } else if (type === 'scene-variants') {
        setRegeneratingSceneVariants((prev) => {
          const next = new Set(prev);
          next.delete(frameId);
          return next;
        });
      }
    },
    []
  );

  // Auto-remove frames from regenerating Sets when generation completes or fails
  // Keep frames in Set while status is 'generating' to maintain UI feedback
  useEffect(() => {
    if (!frames) return;

    frames.forEach((frame) => {
      // Remove from image regenerating set only when generation completes or fails
      if (
        regeneratingImages.has(frame.id) &&
        (frame.thumbnailStatus === 'completed' ||
          frame.thumbnailStatus === 'failed')
      ) {
        handleRegenerateEnd(frame.id, 'image');
      }

      // Remove from motion regenerating set only when generation completes or fails
      if (
        regeneratingMotion.has(frame.id) &&
        (frame.videoStatus === 'completed' || frame.videoStatus === 'failed')
      ) {
        handleRegenerateEnd(frame.id, 'motion');
      }

      // Remove from scene variants regenerating set only when generation completes or fails
      if (
        regeneratingSceneVariants.has(frame.id) &&
        (frame.variantImageStatus === 'completed' ||
          frame.variantImageStatus === 'failed')
      ) {
        handleRegenerateEnd(frame.id, 'scene-variants');
      }
    });
  }, [
    frames,
    regeneratingImages,
    regeneratingMotion,
    regeneratingSceneVariants,
    handleRegenerateEnd,
  ]);

  // Handler for batch motion generation
  const handleBatchMotionGeneration = useCallback(
    async (frameIds: string[]) => {
      if (!sequenceId || frameIds.length === 0) return;

      // Mark all frames as regenerating
      setRegeneratingMotion((prev) => {
        const next = new Set(prev);
        frameIds.forEach((id) => next.add(id));
        return next;
      });

      try {
        await batchGenerateMotionFn({
          data: {
            sequenceId,
            frameIds,
          },
        });
      } catch (error) {
        // On error, remove from regenerating set
        setRegeneratingMotion((prev) => {
          const next = new Set(prev);
          frameIds.forEach((id) => next.delete(id));
          return next;
        });
        throw error;
      }
    },
    [sequenceId]
  );

  return (
    <PageContainer maxWidth="full" fullHeight={true} padding="none">
      <PageHeader>
        <PageHeading>{sequence?.title}</PageHeading>
        <ModelBadge model={sequence?.analysisModel} />
        <ImageModelBadge model={sequence?.imageModel} />
        <VideoModelBadge model={sequence?.videoModel} />
        {/* Show failure badge if sequence failed OR realtime reports failure */}
        {(sequence?.status === 'failed' || generationState.isFailed) && (
          <SequenceStatusBadge status="failed" />
        )}
        {!generationState.isComplete &&
          !generationState.isFailed &&
          generationState.currentPhase > 0 &&
          realtimeStatus === 'connected' && (
            <PhaseIndicatorCompact phases={generationState.phases} />
          )}
      </PageHeader>

      <div className="flex flex-1 min-h-0">
        {/* Desktop: Scene List sidebar */}
        <div className="hidden md:block">
          <SceneList
            frames={frames}
            selectedFrameId={curSelectedFrameId}
            aspectRatio={aspectRatio}
            onSelectFrame={setSelectedFrameId}
            regeneratingImages={regeneratingImages}
            regeneratingMotion={regeneratingMotion}
            onBatchGenerateMotion={handleBatchMotionGeneration}
          />
        </div>

        {/* Mobile: Bottom drawer */}
        <div className="md:hidden">
          <MobileSceneDrawer
            frames={frames}
            selectedFrameId={curSelectedFrameId}
            aspectRatio={aspectRatio}
            onSelectFrame={setSelectedFrameId}
            regeneratingImages={regeneratingImages}
            regeneratingMotion={regeneratingMotion}
            onBatchGenerateMotion={handleBatchMotionGeneration}
          />
        </div>

        {/* Main content area */}
        <ScrollArea className="flex-1 px-4 md:px-8 gap-8 flex flex-col pb-20 md:pb-0">
          <div className="flex flex-1 min-h-0 justify-center pb-8">
            <ScenePlayer
              frames={frames}
              selectedFrameId={curSelectedFrameId}
              aspectRatio={aspectRatio}
              onSelectFrame={setSelectedFrameId}
              selectedTab={selectedTab}
              className={getPlayerMaxClassNameByAspectRatio(aspectRatio)}
            />
          </div>
          <SceneScriptPrompts
            frame={selectedFrame}
            sequenceId={sequenceId ?? ''}
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
            regeneratingImages={regeneratingImages}
            regeneratingMotion={regeneratingMotion}
            regeneratingSceneVariants={regeneratingSceneVariants}
            onRegenerateStart={handleRegenerateStart}
            aspectRatio={aspectRatio}
          />
        </ScrollArea>
      </div>
    </PageContainer>
  );
};
