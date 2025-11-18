'use client';

import { ModelBadge } from '@/components/common/model-badge';
import { PageContainer } from '@/components/layout/page-container';
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
) => {
  return `max-w-[calc(50vh*${aspectRatio.split(':')[0]}/${aspectRatio.split(':')[1]})] max-h-[50vh]`;
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

  // Auto-remove frames from regenerating Sets when database status updates to 'generating'
  // This means the optimistic update has been confirmed by the server
  useEffect(() => {
    if (!frames) return;

    frames.forEach((frame) => {
      // Remove from image regenerating set if thumbnail status is now 'generating' or beyond
      if (
        regeneratingImages.has(frame.id) &&
        (frame.thumbnailStatus === 'generating' ||
          frame.thumbnailStatus === 'completed' ||
          frame.thumbnailStatus === 'failed')
      ) {
        handleRegenerateEnd(frame.id, 'image');
      }

      // Remove from motion regenerating set if video status is now 'generating' or beyond
      if (
        regeneratingMotion.has(frame.id) &&
        (frame.videoStatus === 'generating' ||
          frame.videoStatus === 'completed' ||
          frame.videoStatus === 'failed')
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
