'use client';

import type React from 'react';
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { EvalSequenceRow } from './eval-sequence-row';
import type { SequenceWithFrames } from '@/hooks/use-sequences-with-frames';

type EvalMatrixProps = {
  sequences: SequenceWithFrames[];
  showImages: boolean;
};

export const EvalMatrix: React.FC<EvalMatrixProps> = ({
  sequences,
  showImages,
}) => {
  // Calculate max scene count across all sequences
  const maxSceneCount = useMemo(() => {
    return Math.max(1, ...sequences.map((s) => s.frames.length));
  }, [sequences]);

  return (
    <Card className="flex-1 overflow-hidden">
      <div
        className="grid overflow-auto h-full"
        style={{
          gridTemplateColumns: `280px repeat(${maxSceneCount}, 200px)`,
        }}
      >
        {/* Header row */}
        <div className="sticky left-0 top-0 z-20 bg-background border-b border-r p-4 font-medium text-sm">
          Sequence
        </div>
        {Array.from({ length: maxSceneCount }, (_, i) => (
          <div
            key={i}
            className="sticky top-0 z-10 bg-background border-b p-4 text-center font-medium text-sm"
          >
            Scene {i + 1}
          </div>
        ))}

        {/* Data rows */}
        {sequences.map((sequence) => (
          <EvalSequenceRow
            key={sequence.id}
            sequence={sequence}
            showImages={showImages}
            maxSceneCount={maxSceneCount}
          />
        ))}
      </div>
    </Card>
  );
};
