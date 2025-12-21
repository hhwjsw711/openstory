import { AspectRatioIcon } from '@/components/icons/aspect-ratio-icon';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ASPECT_RATIOS,
  aspectRatioSchema,
  type AspectRatio,
} from '@/lib/constants/aspect-ratios';
import type { FC } from 'react';

function isValidAspectRatio(value: string): value is AspectRatio {
  return aspectRatioSchema.safeParse(value).success;
}

type AspectRatioPillsProps = {
  value: AspectRatio;
  onChange: (value: AspectRatio) => void;
};

export const AspectRatioPills: FC<AspectRatioPillsProps> = ({
  value,
  onChange,
}) => {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(val) => {
        if (val && isValidAspectRatio(val)) {
          onChange(val);
        }
      }}
      variant="outline"
      className="justify-start"
    >
      {ASPECT_RATIOS.map((ratio) => (
        <ToggleGroupItem
          key={ratio.value}
          value={ratio.value}
          className="flex items-center gap-2 h-9 px-3"
          aria-label={`${ratio.label} aspect ratio`}
        >
          <AspectRatioIcon
            width={ratio.width}
            height={ratio.height}
            size="sm"
          />
          <span className="font-mono text-xs">{ratio.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
};
