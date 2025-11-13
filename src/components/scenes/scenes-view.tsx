'use client';

import { ModelBadge } from '@/components/common/model-badge';
import { PageContainer } from '@/components/layout/page-container';
import { ScenePlayer } from '@/components/motion/scene-player';
import { SceneList } from '@/components/scenes/scene-list';
import { SceneScriptPrompts } from '@/components/scenes/scene-script-prompts';
import { PageHeader, PageHeading } from '@/components/typography';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFramesBySequence } from '@/hooks/use-frames';
import { useSequence } from '@/hooks/use-sequences';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import { useMemo, useState } from 'react';

type ScenesViewProps = {
  sequenceId?: string | undefined;
  aspectRatio: AspectRatio;
};

export const getPlayerMaxClassNameByAspectRatio = (
  aspectRatio: AspectRatio
) => {
  if (aspectRatio === '9:16') {
    return 'max-w-[calc(50vh*9/16)] max-h-[50vh]';
  }
  return 'max-h-[50vh] max-w-full';
};
export const ScenesView: React.FC<ScenesViewProps> = ({
  sequenceId,
  aspectRatio,
}) => {
  // State management
  const [selectedFrameId, setSelectedFrameId] = useState<string | undefined>(
    undefined
  );
  const { data: sequence } = useSequence(sequenceId);
  // Fetch frames once at the top level (useSuspenseQuery always returns data)
  const { data: frames } = useFramesBySequence(sequenceId);

  const curSelectedFrameId = selectedFrameId || frames?.[0]?.id;
  const selectedFrame = useMemo(
    () => frames?.find((frame) => frame.id === curSelectedFrameId),
    [frames, curSelectedFrameId]
  );
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
        />

        {/* Right: Scene Player */}
        <ScrollArea className="flex-1 p-8 gap-8 flex flex-col">
          <div className="flex flex-1 min-h-0 justify-center p-4">
            <ScenePlayer
              frames={frames}
              selectedFrameId={curSelectedFrameId}
              aspectRatio={aspectRatio}
              onSelectFrame={setSelectedFrameId}
              className={getPlayerMaxClassNameByAspectRatio(aspectRatio)}
            />
          </div>
          <SceneScriptPrompts frame={selectedFrame} />
        </ScrollArea>
      </div>
    </PageContainer>
  );
};
