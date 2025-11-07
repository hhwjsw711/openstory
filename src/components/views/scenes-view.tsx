'use client';

import { useState } from 'react';
import { useFramesBySequence } from '@/hooks/use-frames';
import { SceneList } from '@/components/scenes/scene-list';
import { ScenePlayer } from '@/components/motion/scene-player';

type ScenesViewProps = {
  sequenceId: string;
};

export const ScenesView: React.FC<ScenesViewProps> = ({ sequenceId }) => {
  // State management
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [completedFrameIds, setCompletedFrameIds] = useState<Set<string>>(
    new Set()
  );

  // Fetch frames for the player
  const { data: frames = [] } = useFramesBySequence(sequenceId);

  const handleToggleComplete = (frameId: string) => {
    setCompletedFrameIds((prev) => {
      const next = new Set(prev);
      if (next.has(frameId)) {
        next.delete(frameId);
      } else {
        next.add(frameId);
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left: Scene List */}
      <SceneList
        sequenceId={sequenceId}
        selectedFrameId={selectedFrameId}
        onSelectFrame={setSelectedFrameId}
        completedFrameIds={completedFrameIds}
        onToggleComplete={handleToggleComplete}
      />

      {/* Right: Scene Player */}
      <div className="flex flex-1 items-center justify-center bg-muted/10 p-8">
        <div className="w-full max-w-4xl">
          <ScenePlayer
            sequenceId={sequenceId}
            frames={frames}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};
