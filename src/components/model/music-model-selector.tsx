import { BaseModelSelector } from './base-model-selector';
import {
  AUDIO_MODELS,
  isValidAudioModel,
  type AudioModel,
} from '@/lib/ai/models';
import { useMemo } from 'react';

const QUALITY_ORDER = ['good', 'better', 'best'] as const;

type MusicModelSelectorProps = {
  selectedModel: AudioModel;
  onModelChange: (model: AudioModel) => void;
  disabled?: boolean;
};

export const MusicModelSelector: React.FC<MusicModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
}) => {
  const models = useMemo(
    () =>
      Object.entries(AUDIO_MODELS)
        .filter(([key, m]) => {
          if (!isValidAudioModel(key)) return false;
          // Only show music models, not SFX
          return m.type === 'music';
        })
        .map(([key, m]) => ({
          id: key,
          name: m.name,
          group: m.performance.quality,
        })),
    []
  );

  return (
    <BaseModelSelector
      label="Music Model"
      models={models}
      groupOrder={QUALITY_ORDER}
      selectedIds={[selectedModel]}
      onSelectionChange={(ids) => {
        const firstId = ids[0];
        if (firstId && isValidAudioModel(firstId)) {
          onModelChange(firstId);
        }
      }}
      disabled={disabled}
      multiSelect={false}
    />
  );
};
