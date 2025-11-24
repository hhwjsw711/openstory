'use client';

import { BaseModelSelector } from './base-model-selector';
import { IMAGE_TO_VIDEO_MODELS, type ImageToVideoModel } from '@/lib/ai/models';
import { useMemo } from 'react';

const QUALITY_ORDER = ['good', 'better', 'best'] as const;

type MotionModelSelectorProps = {
  selectedModel: ImageToVideoModel;
  onModelChange: (model: ImageToVideoModel) => void;
  disabled?: boolean;
};

export const MotionModelSelector: React.FC<MotionModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
}) => {
  const models = useMemo(
    () =>
      Object.entries(IMAGE_TO_VIDEO_MODELS).map(([key, m]) => ({
        id: key,
        name: m.name,
        group: m.performance.quality,
      })),
    []
  );

  return (
    <BaseModelSelector
      label="Motion Model"
      models={models}
      groupOrder={QUALITY_ORDER}
      selectedIds={[selectedModel]}
      onSelectionChange={(ids) => onModelChange(ids[0] as ImageToVideoModel)}
      disabled={disabled}
      multiSelect={false}
    />
  );
};
