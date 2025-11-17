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
  IMAGE_GENERATION_MODELS,
  type ImageGenerationModelId,
} from '@/lib/ai/models.config';
import { ChevronDown } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

type ImageModelSelectorProps = {
  selectedModel: ImageGenerationModelId;
  onModelChange: (model: ImageGenerationModelId) => void;
  disabled?: boolean;
};

export const ImageModelSelector: React.FC<ImageModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
}) => {
  // Control dropdown open state to prevent auto-closing on checkbox clicks
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (modelId: ImageGenerationModelId) => {
      if (disabled) return;
      onModelChange(modelId);
      setOpen(false); // Close dropdown after selection
    },
    [onModelChange, disabled]
  );

  // Display label for button
  const displayLabel = useMemo(() => {
    const model = IMAGE_GENERATION_MODELS.find((m) => m.id === selectedModel);
    return model?.name ?? 'Select model';
  }, [selectedModel]);

  return (
    <div className="space-y-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
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
            Image Models
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {IMAGE_GENERATION_MODELS.map((model) => {
            const isSelected = selectedModel === model.id;

            return (
              <DropdownMenuCheckboxItem
                key={model.id}
                checked={isSelected}
                onCheckedChange={() => handleSelect(model.id)}
                onSelect={(e) => e.preventDefault()}
                disabled={isSelected}
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
    </div>
  );
};
