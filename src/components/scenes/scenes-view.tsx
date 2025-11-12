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
import { useState } from 'react';

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
          selectedFrameId={selectedFrameId || frames?.[0]?.id}
          aspectRatio={aspectRatio}
          onSelectFrame={setSelectedFrameId}
        />

        {/* Right: Scene Player */}
        <div>
          <div className="flex flex-1 flex-col justify-start bg-muted/10 p-8 gap-8 overflow-auto">
            <div className="w-full max-w-4xl flex items-center justify-center">
              <div
                style={{
                  maxHeight: '50vh',
                  maxWidth: '100%',
                  aspectRatio: aspectRatio.replace(':', '/'),
                }}
              >
                <ScenePlayer
                  frames={frames}
                  selectedFrameId={selectedFrameId || frames?.[0]?.id}
                  aspectRatio={aspectRatio}
                  onSelectFrame={setSelectedFrameId}
                  className="w-full h-full"
                />
              </div>
            </div>
            {frames && frames.length > 0 && (
              <div className="w-full max-w-4xl h-min-300 p-4">
                <SceneScriptPrompts
                  frame={frames?.find((frame) => frame.id === selectedFrameId)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
