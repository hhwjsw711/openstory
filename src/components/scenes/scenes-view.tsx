'use client';

import { ModelBadge } from '@/components/common/model-badge';
import { PageContainer } from '@/components/layout/page-container';
import { ScenePlayer } from '@/components/motion/scene-player';
import { SceneList } from '@/components/scenes/scene-list';
import { SceneScriptPrompts } from '@/components/scenes/scene-script-prompts';
import { PageHeader, PageHeading } from '@/components/typography';
import { useFramesBySequence } from '@/hooks/use-frames';
import { useSequence } from '@/hooks/use-sequences';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import { useMemo, useState } from 'react';

type ScenesViewProps = {
  sequenceId?: string | undefined;
  aspectRatio: AspectRatio;
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

      <div className="flex h-full overflow-hidden">
        {/* Left: Scene List */}
        <SceneList
          frames={frames}
          selectedFrameId={curSelectedFrameId}
          aspectRatio={aspectRatio}
          onSelectFrame={setSelectedFrameId}
        />

        {/* Right: Scene Player */}
        <div className="flex-1">
          <div className="flex flex-1 flex-col justify-start bg-muted/10 p-8 gap-8 overflow-auto">
            <div className="w-full flex items-center justify-center">
              <ScenePlayer
                frames={frames}
                selectedFrameId={curSelectedFrameId}
                aspectRatio={aspectRatio}
                onSelectFrame={setSelectedFrameId}
                className="w-full h-full"
              />
            </div>
            <div className="w-full h-min-300 p-4">
              <SceneScriptPrompts frame={selectedFrame} />
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
