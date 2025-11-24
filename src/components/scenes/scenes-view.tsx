'use client';

import { PageContainer } from '@/components/layout/page-container';
import { ModelBadge } from '@/components/model/model-badge';
import { ScenePlayer } from '@/components/motion/scene-player';
import { SceneList } from '@/components/scenes/scene-list';
import {
  SceneScriptPrompts,
  type TabValue,
} from '@/components/scenes/scene-script-prompts';
import { PageHeader, PageHeading } from '@/components/typography';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFramesBySequence } from '@/hooks/use-frames';
import { useSequence } from '@/hooks/use-sequences';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ScenesViewProps = {
  sequenceId?: string | undefined;
  aspectRatio: AspectRatio;
};

export const getPlayerMaxClassNameByAspectRatio = (
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

export const ScenesView: React.FC<ScenesViewProps> = ({
  sequenceId,
  aspectRatio,
}) => {
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

  const { data: sequence } = useSequence(sequenceId);
  // Fetch frames once at the top level (useSuspenseQuery always returns data)
  const { data: frames } = useFramesBySequence(sequenceId);

  const curSelectedFrameId = selectedFrameId || frames?.[0]?.id;
  const selectedFrame = useMemo(
    () => frames?.find((frame) => frame.id === curSelectedFrameId),
    [frames, curSelectedFrameId]
  );

  // Helper functions to manage regeneration state
  const handleRegenerateStart = useCallback(
    (frameId: string, type: 'image' | 'motion') => {
      if (type === 'image') {
        setRegeneratingImages((prev) => new Set(prev).add(frameId));
      } else {
        setRegeneratingMotion((prev) => new Set(prev).add(frameId));
      }
    },
    []
  );

  const handleRegenerateEnd = useCallback(
    (frameId: string, type: 'image' | 'motion') => {
      console.log('handleRegenerateEnd', frameId, type);
      if (type === 'image') {
        setRegeneratingImages((prev) => {
          const next = new Set(prev);
          next.delete(frameId);
          return next;
        });
      } else {
        setRegeneratingMotion((prev) => {
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
    });
  }, [frames, regeneratingImages, regeneratingMotion, handleRegenerateEnd]);

  return (
    <PageContainer maxWidth="full" fullHeight={true} padding="none">
      <PageHeader>
        <PageHeading>{sequence?.title}</PageHeading>
        <ModelBadge model={sequence?.analysisModel} />
      </PageHeader>

      <div className="flex flex-1 min-h-0">
        {/* Left: Scene List */}
        <SceneList
          frames={frames}
          selectedFrameId={curSelectedFrameId}
          aspectRatio={aspectRatio}
          onSelectFrame={setSelectedFrameId}
          regeneratingImages={regeneratingImages}
          regeneratingMotion={regeneratingMotion}
        />

        {/* Right: Scene Player */}
        <ScrollArea className="flex-1 px-8 gap-8 flex flex-col">
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
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
            regeneratingImages={regeneratingImages}
            regeneratingMotion={regeneratingMotion}
            onRegenerateStart={handleRegenerateStart}
          />
        </ScrollArea>
      </div>
    </PageContainer>
  );
};
