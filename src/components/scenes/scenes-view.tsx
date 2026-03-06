import { SequenceStatusBadge } from '@/components/sequence/sequence-status-badge';
import { ScenePlayer } from '@/components/motion/scene-player';
import { MobileSceneDrawer } from '@/components/scenes/mobile-scene-drawer';
import { SceneList } from '@/components/scenes/scene-list';
import {
  SceneScriptPrompts,
  type TabValue,
} from '@/components/scenes/scene-script-prompts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFramesBySequence } from '@/hooks/use-frames';
import { useSequence } from '@/hooks/use-sequences';
import {
  DEFAULT_ASPECT_RATIO,
  type AspectRatio,
} from '@/lib/constants/aspect-ratios';
import { useGenerationStream } from '@/lib/realtime/use-generation-stream';
import { batchGenerateMotionFn } from '@/functions/motion-functions';
import { retryStoryboardFn } from '@/functions/sequences';
import { toast } from 'sonner';
import { BILLING_BALANCE_KEY } from '@/hooks/use-billing-balance';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ScenesViewProps = {
  sequenceId?: string;
};

// Full class names required for Tailwind JIT to detect at build time
const PLAYER_MAX_CLASS_BY_RATIO: Record<AspectRatio, string> = {
  '16:9': 'max-h-[50vh] max-w-[calc(50vh*1.7777777777777777)]',
  '9:16': 'max-h-[50vh] max-w-[calc(50vh*0.5625)]',
  '1:1': 'max-h-[50vh] max-w-[50vh]',
};

type RegenerationType = 'image' | 'motion' | 'scene-variants';

function addToSet(prev: Set<string>, id: string): Set<string> {
  return new Set(prev).add(id);
}

function removeFromSet(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  next.delete(id);
  return next;
}

function addAllToSet(prev: Set<string>, ids: string[]): Set<string> {
  const next = new Set(prev);
  for (const id of ids) next.add(id);
  return next;
}

function removeAllFromSet(prev: Set<string>, ids: string[]): Set<string> {
  const next = new Set(prev);
  for (const id of ids) next.delete(id);
  return next;
}

function isTerminalStatus(status: string | null): boolean {
  return status === 'completed' || status === 'failed';
}

export const ScenesView: React.FC<ScenesViewProps> = ({ sequenceId }) => {
  const queryClient = useQueryClient();

  const [selectedFrameId, setSelectedFrameId] = useState<string | undefined>();
  const [selectedTab, setSelectedTab] = useState<TabValue>('script');

  const [regeneratingImages, setRegeneratingImages] = useState<Set<string>>(
    () => new Set()
  );
  const [regeneratingMotion, setRegeneratingMotion] = useState<Set<string>>(
    () => new Set()
  );
  const [regeneratingSceneVariants, setRegeneratingSceneVariants] = useState<
    Set<string>
  >(() => new Set());

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

  const curSelectedFrameId = selectedFrameId || frames?.[0]?.id;
  const selectedFrame = useMemo(
    () => frames?.find((frame) => frame.id === curSelectedFrameId),
    [frames, curSelectedFrameId]
  );

  const setterForType = useCallback((type: RegenerationType) => {
    switch (type) {
      case 'image':
        return setRegeneratingImages;
      case 'motion':
        return setRegeneratingMotion;
      case 'scene-variants':
        return setRegeneratingSceneVariants;
    }
  }, []);

  const handleRegenerateStart = useCallback(
    (frameId: string, type: RegenerationType) => {
      setterForType(type)((prev) => addToSet(prev, frameId));
    },
    [setterForType]
  );

  const handleRegenerateEnd = useCallback(
    (frameId: string, type: RegenerationType) => {
      setterForType(type)((prev) => removeFromSet(prev, frameId));
    },
    [setterForType]
  );

  // Auto-remove frames from regenerating sets when generation completes or fails
  useEffect(() => {
    if (!frames) return;

    for (const frame of frames) {
      if (
        regeneratingImages.has(frame.id) &&
        isTerminalStatus(frame.thumbnailStatus)
      )
        handleRegenerateEnd(frame.id, 'image');
      if (
        regeneratingMotion.has(frame.id) &&
        isTerminalStatus(frame.videoStatus)
      )
        handleRegenerateEnd(frame.id, 'motion');
      if (
        regeneratingSceneVariants.has(frame.id) &&
        isTerminalStatus(frame.variantImageStatus)
      )
        handleRegenerateEnd(frame.id, 'scene-variants');
    }
  }, [
    frames,
    regeneratingImages,
    regeneratingMotion,
    regeneratingSceneVariants,
    handleRegenerateEnd,
  ]);

  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryStoryboard = useCallback(async () => {
    if (!sequenceId) return;
    setIsRetrying(true);
    try {
      await retryStoryboardFn({ data: { sequenceId } });
      toast.success('Retrying storyboard generation…');
      void queryClient.invalidateQueries({
        queryKey: ['sequence', sequenceId],
      });
      void queryClient.invalidateQueries({ queryKey: ['frames', sequenceId] });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('INSUFFICIENT_CREDITS') ||
          error.message.includes('Insufficient credits'))
      ) {
        toast.error('Insufficient credits', {
          description: 'Add credits to retry storyboard generation.',
          action: {
            label: 'Add Credits',
            onClick: () => {
              window.location.href = '/settings/billing';
            },
          },
        });
        void queryClient.invalidateQueries({
          queryKey: [...BILLING_BALANCE_KEY],
        });
      } else {
        toast.error('Failed to retry', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      setIsRetrying(false);
    }
  }, [sequenceId, queryClient]);

  // Handler for batch motion generation
  const handleBatchMotionGeneration = useCallback(
    async (frameIds: string[]) => {
      if (!sequenceId || frameIds.length === 0) return;

      setRegeneratingMotion((prev) => addAllToSet(prev, frameIds));

      try {
        await batchGenerateMotionFn({ data: { sequenceId, frameIds } });
      } catch (error) {
        setRegeneratingMotion((prev) => removeAllFromSet(prev, frameIds));

        if (
          error instanceof Error &&
          (error.message.includes('INSUFFICIENT_CREDITS') ||
            error.message.includes('Insufficient credits'))
        ) {
          toast.error('Insufficient credits', {
            description: 'Add credits to generate motion for all frames.',
            action: {
              label: 'Add Credits',
              onClick: () => {
                window.location.href = '/settings/billing';
              },
            },
          });
          void queryClient.invalidateQueries({
            queryKey: [...BILLING_BALANCE_KEY],
          });
        } else {
          throw error;
        }
      }
    },
    [sequenceId, queryClient]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Status indicators */}
      {(sequence?.status === 'failed' || generationState.isFailed) && (
        <div className="flex items-center gap-2 px-4 py-2">
          <SequenceStatusBadge status="failed" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRetryStoryboard()}
            disabled={isRetrying}
          >
            <RotateCcw
              className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`}
            />
            {isRetrying ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop: Scene List sidebar */}
        <div className="hidden md:block pl-4 py-4">
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
              progressMessage={
                generationState.phases.find((p) => p.status === 'active')
                  ?.phaseName
              }
              className={PLAYER_MAX_CLASS_BY_RATIO[aspectRatio]}
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
    </div>
  );
};
