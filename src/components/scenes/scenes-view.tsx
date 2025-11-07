'use client';

import { ScenePlayer } from '@/components/motion/scene-player';
import { SceneList } from '@/components/scenes/scene-list';
import { SceneScriptPrompts } from '@/components/scenes/scene-script-prompts';
import { useFramesBySequence } from '@/hooks/use-frames';
import { useState } from 'react';

type ScenesViewProps = {
  sequenceId?: string | undefined;
};

export const ScenesView: React.FC<ScenesViewProps> = ({ sequenceId }) => {
  // State management
  const [selectedFrameId, setSelectedFrameId] = useState<string | undefined>(
    undefined
  );

  // Fetch frames once at the top level (useSuspenseQuery always returns data)
  const { data: frames } = useFramesBySequence(sequenceId);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Scene List */}
      <SceneList
        frames={frames}
        selectedFrameId={selectedFrameId || frames?.[0]?.id}
        onSelectFrame={setSelectedFrameId}
      />

      {/* Right: Scene Player */}
      <div className="flex flex-1 flex-col items-center justify-start bg-muted/10 p-8 gap-8">
        <div className="w-full max-w-4xl">
          <ScenePlayer
            frames={frames}
            selectedFrameId={selectedFrameId || frames?.[0]?.id}
            onSelectFrame={setSelectedFrameId}
            className="w-full"
          />
        </div>
        {frames && frames.length > 0 && (
          <div className="w-full max-w-4xl overflow-auto p-4">
            <SceneScriptPrompts
              frame={frames?.find((frame) => frame.id === selectedFrameId)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
