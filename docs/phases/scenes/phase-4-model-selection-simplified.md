# Phase 4: Model Selection (Simplified)

## Objective

Build model selectors for image and motion generation using shadcn ToggleGroup with existing model constants.

## Dependencies

- Phase 3 (scene tabs with placeholders)

## Files to Create

### Components

- `src/components/scenes/model-toggle-group.tsx` - Wrapper around ToggleGroup for model selection

### Utilities

- `src/lib/scenes/model-display.ts` - Display metadata (icons, short names) for existing models

### Stories

- `src/components/scenes/model-toggle-group.stories.tsx`

## Existing APIs to Use

### Model Definitions (Already Exist!)

```typescript
import { IMAGE_MODELS, IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';
import type { FalImageModel, ImageToVideoModel } from '@/lib/ai/models';

// Image models (keys): flux_krea_lora, nano_banana, hidream_i1_full, recraft_v3
// Motion models (keys): svd_lcm, wan_i2v, kling_v2_5_turbo_pro, wan_2_5, veo3_1
```

### ToggleGroup Component

```typescript
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// Multi-select usage:
<ToggleGroup type="multiple" value={selectedModels} onValueChange={setSelectedModels}>
  <ToggleGroupItem value="model1">Model 1</ToggleGroupItem>
  <ToggleGroupItem value="model2">Model 2</ToggleGroupItem>
</ToggleGroup>
```

## Component Specifications

### 1. Model Display Metadata

**File:** `src/lib/scenes/model-display.ts`

Create minimal display metadata that maps to existing model constants:

```typescript
import {
  Sparkles,
  Zap,
  Target,
  Palette,
  Clapperboard,
  Video,
  Waves,
  Flame,
  type LucideIcon,
} from 'lucide-react';
import type { FalImageModel, ImageToVideoModel } from '@/lib/ai/models';

export type ModelDisplayInfo = {
  icon: LucideIcon;
  shortName: string;
};

/**
 * Display info for image generation models
 * Maps to keys in IMAGE_MODELS
 */
export const IMAGE_MODEL_DISPLAY: Record<FalImageModel, ModelDisplayInfo> = {
  flux_krea_lora: { icon: Sparkles, shortName: 'Flux Krea' },
  nano_banana: { icon: Zap, shortName: 'Nano' },
  hidream_i1_full: { icon: Target, shortName: 'HiDream' },
  recraft_v3: { icon: Palette, shortName: 'Recraft' },
  // Add others as needed...
  flux_pro: { icon: Sparkles, shortName: 'Flux Pro' },
  flux_dev: { icon: Sparkles, shortName: 'Flux Dev' },
  flux_schnell: { icon: Zap, shortName: 'Flux Fast' },
  sdxl: { icon: Target, shortName: 'SDXL' },
  sdxl_lightning: { icon: Zap, shortName: 'SDXL Fast' },
  flux_pro_kontext_max: { icon: Sparkles, shortName: 'Flux Max' },
  imagen4_preview_ultra: { icon: Target, shortName: 'Imagen 4' },
  flux_pro_v1_1_ultra: { icon: Sparkles, shortName: 'Flux Ultra' },
  letzai: { icon: Palette, shortName: 'LetzAI' },
};

/**
 * Display info for motion/video models
 * Maps to keys in IMAGE_TO_VIDEO_MODELS
 */
export const MOTION_MODEL_DISPLAY: Record<ImageToVideoModel, ModelDisplayInfo> =
  {
    svd_lcm: { icon: Zap, shortName: 'Fast' },
    wan_i2v: { icon: Waves, shortName: 'WAN 2.1' },
    kling_i2v: { icon: Clapperboard, shortName: 'Kling 1.5' },
    seedance_v1_pro: { icon: Video, shortName: 'Seedance' },
    veo2_i2v: { icon: Video, shortName: 'Veo 2' },
    veo3: { icon: Video, shortName: 'Veo 3' },
    wan_v2: { icon: Waves, shortName: 'WAN 2.2' },
    veo3_1: { icon: Video, shortName: 'Veo 3.1' },
    kling_v2_5_turbo_pro: { icon: Clapperboard, shortName: 'Kling Pro' },
    wan_2_5: { icon: Waves, shortName: 'WAN 2.5' },
    sora_2: { icon: Flame, shortName: 'Sora 2' },
  };

/**
 * Get suggested default selections for image models
 */
export function getDefaultImageModels(): FalImageModel[] {
  return ['flux_krea_lora', 'nano_banana', 'hidream_i1_full', 'recraft_v3'];
}

/**
 * Get suggested default selections for motion models
 */
export function getDefaultMotionModels(): ImageToVideoModel[] {
  return ['svd_lcm', 'wan_2_5', 'kling_v2_5_turbo_pro', 'veo3_1'];
}
```

### 2. ModelToggleGroup Component

**File:** `src/components/scenes/model-toggle-group.tsx`

Simple wrapper around shadcn ToggleGroup:

```typescript
'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export type ModelOption = {
  value: string;
  icon: LucideIcon;
  label: string;
  description?: string;
};

type ModelToggleGroupProps = {
  models: ModelOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  maxSelections?: number;
  className?: string;
};

export const ModelToggleGroup: React.FC<ModelToggleGroupProps> = ({
  models,
  value,
  onValueChange,
  maxSelections,
  className,
}) => {
  const handleValueChange = (newValue: string[]) => {
    // Enforce max selections if specified
    if (maxSelections && newValue.length > maxSelections) {
      return;
    }
    onValueChange(newValue);
  };

  return (
    <TooltipProvider>
      <ToggleGroup
        type="multiple"
        value={value}
        onValueChange={handleValueChange}
        className={cn('flex-wrap', className)}
      >
        {models.map((model) => (
          <Tooltip key={model.value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={model.value}
                aria-label={model.label}
                className="flex items-center gap-2"
              >
                <model.icon className="h-4 w-4" />
                <span className="text-sm">{model.label}</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            {model.description && (
              <TooltipContent>
                <p className="text-xs">{model.description}</p>
              </TooltipContent>
            )}
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
};
```

### 3. Update ImagePromptTab and MotionPromptTab

**Replace placeholders from Phase 3:**

```tsx
// In ImagePromptTab
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { ModelToggleGroup, type ModelOption } from './model-toggle-group';
import { IMAGE_MODELS } from '@/lib/ai/models';
import type { FalImageModel } from '@/lib/ai/models';
import {
  IMAGE_MODEL_DISPLAY,
  getDefaultImageModels,
} from '@/lib/scenes/model-display';

// Create model options from existing constants
const imageModelOptions: ModelOption[] = Object.entries(IMAGE_MODEL_DISPLAY)
  .map(([key, display]) => ({
    value: key,
    icon: display.icon,
    label: display.shortName,
    description: `Model: ${IMAGE_MODELS[key as FalImageModel]}`,
  }))
  .slice(0, 4); // Show first 4 for now

export const ImagePromptTab: React.FC = () => {
  const [selectedModels, setSelectedModels] = useState<string[]>(
    getDefaultImageModels()
  );

  const handleGenerate = () => {
    console.log('Generate with models:', selectedModels);
    // Phase 6 will implement actual regeneration
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Textarea from Phase 3 */}
      <textarea
        placeholder="Describe the image..."
        className="min-h-[100px] resize-y"
      />

      {/* Model selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Select Models (up to 4)
        </label>
        <ModelToggleGroup
          models={imageModelOptions}
          value={selectedModels}
          onValueChange={setSelectedModels}
          maxSelections={4}
        />
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={selectedModels.length === 0}
        className="w-full"
      >
        <Zap className="h-4 w-4 mr-2" />
        Multi-Generate ({selectedModels.length} models)
      </Button>
    </div>
  );
};
```

```tsx
// In MotionPromptTab (similar pattern)
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { ModelToggleGroup, type ModelOption } from './model-toggle-group';
import { IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';
import type { ImageToVideoModel } from '@/lib/ai/models';
import {
  MOTION_MODEL_DISPLAY,
  getDefaultMotionModels,
} from '@/lib/scenes/model-display';

// Create model options from existing constants
const motionModelOptions: ModelOption[] = Object.entries(MOTION_MODEL_DISPLAY)
  .map(([key, display]) => ({
    value: key,
    icon: display.icon,
    label: display.shortName,
    description: IMAGE_TO_VIDEO_MODELS[key as ImageToVideoModel].name,
  }))
  .slice(0, 5); // Show first 5 for now

export const MotionPromptTab: React.FC = () => {
  const [selectedModels, setSelectedModels] = useState<string[]>(
    getDefaultMotionModels()
  );

  const handleGenerate = () => {
    console.log('Generate with models:', selectedModels);
    // Phase 6 will implement actual regeneration
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Textarea from Phase 3 */}
      <textarea
        placeholder="Describe the motion..."
        className="min-h-[100px] resize-y"
      />

      {/* Model selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Select Models
        </label>
        <ModelToggleGroup
          models={motionModelOptions}
          value={selectedModels}
          onValueChange={setSelectedModels}
        />
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={selectedModels.length === 0}
        className="w-full"
      >
        <Zap className="h-4 w-4 mr-2" />
        Multi-Generate ({selectedModels.length} models)
      </Button>
    </div>
  );
};
```

## Implementation Guidelines

### Benefits of This Approach

1. **Uses existing types**: No need to redefine model IDs - they come from `@/lib/ai/models`
2. **Simpler state**: Just `string[]` for selected model keys
3. **Native multi-select**: ToggleGroup handles selection logic
4. **Less code**: No custom reducer, no custom card components
5. **Theme-aware**: ToggleGroup automatically uses theme variables

### Default Selections

```typescript
// Image models: start with 4 selected
const [selectedImageModels, setSelectedImageModels] = useState<string[]>(
  getDefaultImageModels()
);

// Motion models: start with 4 selected
const [selectedMotionModels, setSelectedMotionModels] = useState<string[]>(
  getDefaultMotionModels()
);
```

## Acceptance Criteria

- [ ] Image tab shows 4 image model toggles
- [ ] Motion tab shows 5 motion model toggles
- [ ] Models can be toggled on/off
- [ ] Selected models show highlighted state (via ToggleGroup)
- [ ] Hover tooltip displays model description
- [ ] Multi-Generate button shows selected count
- [ ] Multi-Generate button is disabled when no models selected
- [ ] Model selection respects max limit (4 for image)
- [ ] Default models selected on load
- [ ] All Storybook stories render without errors

## Storybook Stories

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ModelToggleGroup } from './model-toggle-group';
import { Sparkles, Zap, Target, Palette } from 'lucide-react';

const meta: Meta<typeof ModelToggleGroup> = {
  title: 'Scenes/ModelToggleGroup',
  component: ModelToggleGroup,
};

export default meta;
type Story = StoryObj<typeof ModelToggleGroup>;

const sampleModels = [
  { value: 'flux_krea_lora', icon: Sparkles, label: 'Flux Krea' },
  { value: 'nano_banana', icon: Zap, label: 'Nano' },
  { value: 'hidream_i1_full', icon: Target, label: 'HiDream' },
  { value: 'recraft_v3', icon: Palette, label: 'Recraft' },
];

export const Default: Story = {
  args: {
    models: sampleModels,
    value: ['flux_krea_lora', 'nano_banana'],
    onValueChange: (value) => console.log('Selected:', value),
  },
};

export const AllSelected: Story = {
  args: {
    models: sampleModels,
    value: sampleModels.map((m) => m.value),
    onValueChange: (value) => console.log('Selected:', value),
  },
};

export const NoneSelected: Story = {
  args: {
    models: sampleModels,
    value: [],
    onValueChange: (value) => console.log('Selected:', value),
  },
};

export const WithMaxSelections: Story = {
  args: {
    models: sampleModels,
    value: ['flux_krea_lora', 'nano_banana'],
    onValueChange: (value) => console.log('Selected:', value),
    maxSelections: 2,
  },
};
```

## Testing

### Manual Testing

1. Open image prompt tab
2. Click toggles to select/deselect models
3. Verify selected state highlighting
4. Hover over models to see tooltips
5. Check Multi-Generate button updates count
6. Try selecting more than max (should be prevented)
7. Repeat for motion tab
8. Test on mobile viewport

### Unit Tests

Test selection logic:

```typescript
import { describe, expect, test } from 'bun:test';
import { getDefaultImageModels, getDefaultMotionModels } from './model-display';

describe('model-display', () => {
  test('getDefaultImageModels returns valid model keys', () => {
    const defaults = getDefaultImageModels();
    expect(defaults.length).toBeGreaterThan(0);
    expect(defaults.every((key) => typeof key === 'string')).toBe(true);
  });

  test('getDefaultMotionModels returns valid model keys', () => {
    const defaults = getDefaultMotionModels();
    expect(defaults.length).toBeGreaterThan(0);
    expect(defaults.every((key) => typeof key === 'string')).toBe(true);
  });
});
```

## Commit Message

```
feat: add model selection with shadcn ToggleGroup

- Create ModelToggleGroup wrapper component
- Add model display metadata mapping to existing model constants
- Update ImagePromptTab with model selector (4 models)
- Update MotionPromptTab with model selector (5 models)
- Add Multi-Generate button with selected count
- Use existing IMAGE_MODELS and IMAGE_TO_VIDEO_MODELS types
- Include Storybook stories for toggle group
```

## Next Phase

After committing this phase, proceed to **Phase 5: Version Timeline**.

## Notes

- Model keys (`flux_krea_lora`, `wan_2_5`, etc.) come directly from `@/lib/ai/models`
- No need for separate reducer - ToggleGroup handles state internally
- Model IDs for API calls: use `IMAGE_MODELS[key]` or `IMAGE_TO_VIDEO_MODELS[key].id`
- ToggleGroup automatically handles theme, hover states, selection highlighting
- Much simpler than custom card components - uses battle-tested shadcn component
- Icons and short names in display metadata keep UI compact
