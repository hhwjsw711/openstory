import { BaseModelSelector } from './base-model-selector';
import { IMAGE_MODELS, type TextToImageModel } from '@/lib/ai/models';
import { useMemo } from 'react';

const TIER_ORDER = [
  'ultra-fast',
  'high quality',
  'fast',
  'balanced',
  'premium',
] as const;

type ImageModelSelectorProps = {
  selectedModel: TextToImageModel;
  onModelChange: (model: TextToImageModel) => void;
  disabled?: boolean;
};

export const ImageModelSelector: React.FC<ImageModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
}) => {
  const models = useMemo(
    () =>
      Object.entries(IMAGE_MODELS).map(([key, m]) => ({
        id: key,
        name: m.name,
        group: m.tier,
      })),
    []
  );

  return (
    <BaseModelSelector
      label="Image Model"
      models={models}
      groupOrder={TIER_ORDER}
      selectedIds={[selectedModel]}
      onSelectionChange={(ids) => onModelChange(ids[0] as TextToImageModel)}
      disabled={disabled}
      multiSelect={false}
    />
  );
};
