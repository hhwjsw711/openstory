import { AspectRatioIcon } from '@/components/icons/aspect-ratio-icon';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ASPECT_RATIOS, type AspectRatio } from '@/lib/constants/aspect-ratios';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export type AspectRatioSelectProps = {
  value?: AspectRatio;
  onChange?: (value: AspectRatio) => void;
  disabled?: boolean;
  placeholder?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'horizontal' | 'vertical';
  className?: string;
};

export const AspectRatioSelect = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Aspect ratio',
  size = 'default',
  variant = 'horizontal',
  className,
}: AspectRatioSelectProps) => {
  const selectedRatio = ASPECT_RATIOS.find((r) => r.value === value);

  if (variant === 'vertical') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={size}
            disabled={disabled}
            className={cn(
              'flex-col h-auto py-3 px-4 gap-2',
              size === 'sm' && 'py-2 px-3',
              size === 'lg' && 'py-4 px-5',
              className
            )}
            aria-label="Select aspect ratio"
          >
            {selectedRatio ? (
              <>
                <AspectRatioIcon
                  width={selectedRatio.width}
                  height={selectedRatio.height}
                  size={size}
                />
                <span className="font-semibold">{selectedRatio.label}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(val) => onChange?.(val as AspectRatio)}
          >
            {ASPECT_RATIOS.map((ratio) => (
              <DropdownMenuRadioItem key={ratio.value} value={ratio.value}>
                <AspectRatioIcon
                  width={ratio.width}
                  height={ratio.height}
                  size={size}
                />
                <span>{ratio.label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={disabled}
          className={className}
          aria-label="Select aspect ratio"
        >
          <span className="flex items-center gap-2 flex-1">
            {selectedRatio ? (
              <>
                <AspectRatioIcon
                  width={selectedRatio.width}
                  height={selectedRatio.height}
                  size={size}
                />
                <span>{selectedRatio.label}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(val) => onChange?.(val as AspectRatio)}
        >
          {ASPECT_RATIOS.map((ratio) => (
            <DropdownMenuRadioItem key={ratio.value} value={ratio.value}>
              <AspectRatioIcon
                width={ratio.width}
                height={ratio.height}
                size={size}
              />
              <span>{ratio.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
