import { BaseModelSelector } from './base-model-selector';
import {
  SCRIPT_ANALYSIS_MODELS,
  type AnalysisModelId,
} from '@/lib/ai/models.config';
import { useMemo } from 'react';

const TIER_ORDER = ['ultra-fast', 'fast', 'premium'] as const;

type ModelSelectorProps = {
  selectedModels: AnalysisModelId[];
  onModelsChange: (models: AnalysisModelId[]) => void;
  disabled?: boolean;
  singleSelect?: boolean;
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModels,
  onModelsChange,
  disabled = false,
  singleSelect = false,
}) => {
  const models = useMemo(
    () =>
      SCRIPT_ANALYSIS_MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        group: m.tier,
      })),
    []
  );

  return (
    <BaseModelSelector
      label="Analysis Model"
      models={models}
      groupOrder={TIER_ORDER}
      selectedIds={selectedModels}
      onSelectionChange={(ids) => onModelsChange(ids as AnalysisModelId[])}
      disabled={disabled}
      multiSelect={!singleSelect}
    />
  );
};
