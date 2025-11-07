'use client';

import { ScenePlayer } from '@/components/motion/scene-player';
import { SceneList } from '@/components/scenes/scene-list';
import { useFramesBySequence } from '@/hooks/use-frames';
import { useState } from 'react';

type ScenesViewProps = {
  sequenceId: string;
};

export const ScenesView: React.FC<ScenesViewProps> = ({ sequenceId }) => {
  // State management
  const [selectedFrameId, setSelectedFrameId] = useState<string | undefined>(
    undefined
  );

  // Fetch frames once at the top level (useSuspenseQuery always returns data)
  const { data: frames } = useFramesBySequence(sequenceId);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left: Scene List */}
      <SceneList
        frames={frames}
        selectedFrameId={selectedFrameId || frames?.[0]?.id}
        onSelectFrame={setSelectedFrameId}
      />

      {/* Right: Scene Player */}
      <div className="flex flex-1 items-center justify-center bg-muted/10 p-8">
        <div className="w-full max-w-4xl">
          <ScenePlayer
            sequenceId={sequenceId}
            frames={frames}
            selectedFrameId={selectedFrameId || frames?.[0]?.id}
            onSelectFrame={setSelectedFrameId}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};
