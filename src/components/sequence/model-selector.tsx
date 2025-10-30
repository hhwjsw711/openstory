import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SCRIPT_ANALYSIS_MODELS,
  type AnalysisModelId,
} from '@/lib/ai/models.config';
import { ChevronDown } from 'lucide-react';
import { useCallback, useMemo } from 'react';

interface ModelSelectorProps {
  selectedModels: AnalysisModelId[];
  onModelsChange: (models: AnalysisModelId[]) => void;
  disabled?: boolean;
  singleSelect?: boolean; // When true, only one model can be selected at a time
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModels,
  onModelsChange,
  disabled = false,
  singleSelect = false,
}) => {
  const handleToggle = useCallback(
    (modelId: AnalysisModelId, checked: boolean) => {
      if (disabled) return;

      if (singleSelect) {
        // In single select mode, always replace the selection
        if (checked) {
          onModelsChange([modelId]);
        }
        // Don't allow unchecking in single select mode
      } else {
        if (checked) {
          // Add model
          onModelsChange([...selectedModels, modelId]);
        } else {
          // Remove model - but ensure at least one remains
          if (selectedModels.length > 1) {
            onModelsChange(selectedModels.filter((id) => id !== modelId));
          }
        }
      }
    },
    [selectedModels, onModelsChange, disabled, singleSelect]
  );

  // Display label for button
  const displayLabel = useMemo(() => {
    if (selectedModels.length === 0) {
      return 'Select models';
    }

    const firstModel = SCRIPT_ANALYSIS_MODELS.find(
      (m) => m.id === selectedModels[0]
    );
    const firstName = firstModel?.name ?? 'Unknown';

    if (selectedModels.length === 1) {
      return firstName;
    }

    return `${firstName} + ${selectedModels.length - 1}`;
  }, [selectedModels]);

  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-[260px] justify-between"
            disabled={disabled}
          >
            <span className="text-sm">{displayLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[260px]">
          <DropdownMenuLabel className="text-xs">
            Analysis Models
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SCRIPT_ANALYSIS_MODELS.map((model) => {
            const isSelected = selectedModels.includes(model.id);
            const isLastSelected = isSelected && selectedModels.length === 1;
            // In single select mode, disable the currently selected model
            const isDisabled = singleSelect ? isSelected : isLastSelected;

            return (
              <DropdownMenuCheckboxItem
                key={model.id}
                checked={isSelected}
                onCheckedChange={(checked) => handleToggle(model.id, checked)}
                disabled={isDisabled}
                className="cursor-pointer"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{model.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {model.tier}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {model.description}
                  </span>
                </div>
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {!singleSelect && (
        <p className="text-xs text-muted-foreground">
          {selectedModels.length === 1
            ? '1 sequence will be created'
            : `${selectedModels.length} sequences will be created`}
        </p>
      )}
    </div>
  );
};
