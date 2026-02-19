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
import { PageHeader } from '@/components/typography/page-header';
import { PageHeading } from '@/components/typography/page-heading';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFramesBySequence } from '@/hooks/use-frames';
import { useWorkflowStatus } from '@/hooks/use-workflow-status';
import { useSequence } from '@/hooks/use-sequences';
import {
  DEFAULT_ASPECT_RATIO,
  type AspectRatio,
} from '@/lib/constants/aspect-ratios';
import { useGenerationStream } from '@/lib/realtime/use-generation-stream';
import { batchGenerateMotionFn } from '@/functions/motion-functions';
import { toast } from 'sonner';
import { BILLING_BALANCE_KEY } from '@/hooks/use-billing-balance';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import type { FrameWorkflowType } from '@/lib/workflow/status';

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

/** Map UI type names to workflow type identifiers */
function toWorkflowType(
  type: 'image' | 'motion' | 'scene-variants'
): FrameWorkflowType {
  if (type === 'scene-variants') return 'variant';
  return type;
}

export const ScenesView: React.FC<ScenesViewProps> = ({ sequenceId }) => {
  const queryClient = useQueryClient();

  // State management
  const [selectedFrameId, setSelectedFrameId] = useState<string | undefined>(
    undefined
  );
  const [selectedTab, setSelectedTab] = useState<TabValue>('script');

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
  const realtimeFailed = realtimeStatus === 'error';
  const shouldPoll = isProcessing && realtimeFailed;
  const pollInterval = shouldPoll ? 2000 : false;

  // Fetch frames
  const { data: frames } = useFramesBySequence(sequenceId, {
    refetchInterval: pollInterval,
  });

  // Live workflow status from QStash (replaces DB status fields)
  const frameIds = useMemo(() => frames?.map((f) => f.id) ?? [], [frames]);
  const {
    generatingImages: regeneratingImages,
    generatingMotion: regeneratingMotion,
    generatingVariants: regeneratingSceneVariants,
    markGenerating,
  } = useWorkflowStatus(sequenceId, frameIds);

  // Use the most recent sequence data
  const curSelectedFrameId = selectedFrameId || frames?.[0]?.id;
  const selectedFrame = useMemo(
    () => frames?.find((frame) => frame.id === curSelectedFrameId),
    [frames, curSelectedFrameId]
  );

  // Optimistically mark a workflow as active when the user triggers generation
  const handleRegenerateStart = useCallback(
    (frameId: string, type: 'image' | 'motion' | 'scene-variants') => {
      markGenerating(frameId, toWorkflowType(type));
    },
    [markGenerating]
  );

  // Handler for batch motion generation
  const handleBatchMotionGeneration = useCallback(
    async (batchFrameIds: string[]) => {
      if (!sequenceId || batchFrameIds.length === 0) return;

      // Optimistically mark all frames as generating motion
      batchFrameIds.forEach((id) => markGenerating(id, 'motion'));

      try {
        await batchGenerateMotionFn({
          data: {
            sequenceId,
            frameIds: batchFrameIds,
          },
        });
      } catch (error) {
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
    [sequenceId, markGenerating, queryClient]
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
