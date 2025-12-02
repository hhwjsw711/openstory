'use client';

import type React from 'react';
import { EvalSequenceMetadata } from './eval-sequence-metadata';
import { EvalSceneCell } from './eval-scene-cell';
import type { SequenceWithFrames } from '@/hooks/use-sequences-with-frames';

type EvalSequenceRowProps = {
  sequence: SequenceWithFrames;
  showImages: boolean;
  maxSceneCount: number;
};

export const EvalSequenceRow: React.FC<EvalSequenceRowProps> = ({
  sequence,
  showImages,
  maxSceneCount,
}) => {
  return (
    <>
      <EvalSequenceMetadata sequence={sequence} />
      {Array.from({ length: maxSceneCount }, (_, i) => {
        const frame = sequence.frames[i];
        return (
          <EvalSceneCell
            key={i}
            frame={frame}
            showImages={showImages}
            sceneNumber={i + 1}
          />
        );
      })}
    </>
  );
};
