import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IMAGE_MODELS, type TextToImageModel } from '@/lib/ai/models';
import { ChevronDown } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

type ImageModelSelectorProps = {
  selectedModel: TextToImageModel;
  onModelChange: (model: TextToImageModel) => void;
  disabled?: boolean;
  promptLength?: number;
};

export const ImageModelSelector: React.FC<ImageModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
  promptLength = 0,
}) => {
  // Control dropdown open state to prevent auto-closing on checkbox clicks
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (modelId: TextToImageModel) => {
      if (disabled) return;
      onModelChange(modelId);
      setOpen(false); // Close dropdown after selection
    },
    [onModelChange, disabled]
  );

  // Filter models based on prompt length
  const availableModels = useMemo(() => {
    return Object.entries(IMAGE_MODELS).map(([key, model]) => ({
      ...model,
      id: key as TextToImageModel,
      isAvailable: promptLength <= model.maxPromptLength,
    }));
  }, [promptLength]);

  // Display label for button
  const displayLabel = useMemo(() => {
    const model = availableModels.find((m) => m.id === selectedModel);
    return model?.name ?? 'Select model';
  }, [availableModels, selectedModel]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <span>{displayLabel}</span>
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Image Models</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableModels.map((model) => {
          const isSelected = selectedModel === model.id;
          const isDisabledByPromptLength = !model.isAvailable;

          return (
            <DropdownMenuCheckboxItem
              key={model.id}
              checked={isSelected}
              onCheckedChange={() => handleSelect(model.id)}
              onSelect={(e) => e.preventDefault()}
              disabled={isSelected || isDisabledByPromptLength}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {model.tier}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {isDisabledByPromptLength
                    ? `Prompt too long (max ${model.maxPromptLength} chars)`
                    : model.description}
                </span>
              </div>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
