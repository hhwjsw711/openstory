import { BaseModelSelector } from './base-model-selector';
import {
  IMAGE_TO_VIDEO_MODELS,
  isModelCompatibleWithAspectRatio,
  isValidImageToVideoModel,
  type ImageToVideoModel,
} from '@/lib/ai/models';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import { useMemo } from 'react';

const QUALITY_ORDER = ['good', 'better', 'best'] as const;

type MotionModelSelectorProps = {
  selectedModel: ImageToVideoModel;
  onModelChange: (model: ImageToVideoModel) => void;
  disabled?: boolean;
  aspectRatio?: AspectRatio;
};

export const MotionModelSelector: React.FC<MotionModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
  aspectRatio,
}) => {
  const models = useMemo(
    () =>
      Object.entries(IMAGE_TO_VIDEO_MODELS)
        .filter(([key]) => {
          if (!isValidImageToVideoModel(key)) return false;
          return aspectRatio
            ? isModelCompatibleWithAspectRatio(key, aspectRatio)
            : true;
        })
        .map(([key, m]) => ({
          id: key,
          name: m.name,
          group: m.performance.quality,
        })),
    [aspectRatio]
  );

  return (
    <BaseModelSelector
      label="Motion Model"
      models={models}
      groupOrder={QUALITY_ORDER}
      selectedIds={[selectedModel]}
      onSelectionChange={(ids) => {
        const firstId = ids[0];
        if (firstId && isValidImageToVideoModel(firstId)) {
          onModelChange(firstId);
        }
      }}
      disabled={disabled}
      multiSelect={false}
    />
  );
};
