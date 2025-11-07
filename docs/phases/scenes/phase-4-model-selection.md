# Phase 4: Model Selection Grid

## Objective

Build the model selector grids for image and motion generation with multi-select capability, replacing the placeholders from Phase 3.

## Dependencies

- Phase 3 (scene tabs with placeholders)

## Files to Create

### Components

- `src/components/scenes/model-selector-grid.tsx` - Reusable model grid component
- `src/components/scenes/model-card.tsx` - Individual model card with icon and selection state

### Utilities

- `src/lib/scenes/model-definitions.ts` - Model metadata (icons, descriptions, display names)
- `src/lib/scenes/model-selection.reducer.ts` - Model selection state management

### Stories

- `src/components/scenes/model-card.stories.tsx`
- `src/components/scenes/model-selector-grid.stories.tsx`

## Existing APIs to Use

### Model Definitions

```typescript
import { IMAGE_MODELS, IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';
// These contain the actual model IDs and capabilities
```

## Component Specifications

### 1. Model Definitions

**File:** `src/lib/scenes/model-definitions.ts`

Create display metadata for each model:

```typescript
import {
  Sparkles,
  Zap,
  Target,
  Sprout,
  Music,
  Clapperboard,
  Video,
  Waves,
  type LucideIcon,
} from 'lucide-react';

export type ModelDefinition = {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
};

/**
 * Image generation models
 */
export const IMAGE_MODEL_DEFINITIONS: ModelDefinition[] = [
  {
    id: 'flux-krea',
    name: 'Flux Krea',
    icon: Sparkles,
    description:
      'Best for creative and artistic generations with vibrant colors',
  },
  {
    id: 'nano-banana',
    name: 'Nano Banana',
    icon: Zap,
    description: 'Ultra-fast generation, ideal for quick iterations',
  },
  {
    id: 'qwen',
    name: 'Qwen',
    icon: Target,
    description: 'Excellent precision and detail for realistic imagery',
  },
  {
    id: 'seedream',
    name: 'Seedream',
    icon: Sprout,
    description: 'Specialized in natural and organic compositions',
  },
];

/**
 * Motion/video generation models
 */
export const MOTION_MODEL_DEFINITIONS: ModelDefinition[] = [
  {
    id: 'ray3',
    name: 'Ray3',
    icon: Zap,
    description: 'Lightning-fast rendering with smooth motion',
  },
  {
    id: 'seedance',
    name: 'Seedance',
    icon: Music,
    description: 'Specialized in dynamic and fluid movements',
  },
  {
    id: 'kling-2.5',
    name: 'Kling 2.5',
    icon: Clapperboard,
    description: 'Cinematic quality with advanced camera movements',
  },
  {
    id: 'veo-3.1',
    name: 'Veo 3.1',
    icon: Video,
    description: 'Professional-grade video with realistic physics',
  },
  {
    id: 'wan-2.5',
    name: 'Wan 2.5',
    icon: Waves,
    description: 'Best for organic and natural motion patterns',
  },
];
```

### 2. Model Selection Reducer

**File:** `src/lib/scenes/model-selection.reducer.ts`

Manage model selection state:

```typescript
export type ModelSelectionState = {
  selectedModels: string[];
};

export type ModelSelectionAction =
  | { type: 'TOGGLE_MODEL'; modelId: string }
  | { type: 'SELECT_MODEL'; modelId: string }
  | { type: 'DESELECT_MODEL'; modelId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_SELECTION'; modelIds: string[] };

export const initialModelSelectionState: ModelSelectionState = {
  selectedModels: [],
};

export function modelSelectionReducer(
  state: ModelSelectionState,
  action: ModelSelectionAction
): ModelSelectionState {
  switch (action.type) {
    case 'TOGGLE_MODEL':
      return {
        ...state,
        selectedModels: state.selectedModels.includes(action.modelId)
          ? state.selectedModels.filter((id) => id !== action.modelId)
          : [...state.selectedModels, action.modelId],
      };

    case 'SELECT_MODEL':
      return {
        ...state,
        selectedModels: state.selectedModels.includes(action.modelId)
          ? state.selectedModels
          : [...state.selectedModels, action.modelId],
      };

    case 'DESELECT_MODEL':
      return {
        ...state,
        selectedModels: state.selectedModels.filter(
          (id) => id !== action.modelId
        ),
      };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedModels: [],
      };

    case 'SET_SELECTION':
      return {
        ...state,
        selectedModels: action.modelIds,
      };

    default:
      return state;
  }
}
```

### 3. ModelCard Component

**Purpose:** Display individual model with selection state

**Props:**

```typescript
type ModelCardProps = {
  model: ModelDefinition;
  isSelected: boolean;
  onToggle: () => void;
};
```

**Features:**

- Square aspect ratio (aspect-square)
- Icon (14px)
- Model name (7px font-medium)
- Selection indicator: checkmark badge (top-right, 16px circle)
- Hover tooltip with description
- Hover scale effect (scale-105)
- Visual states: selected vs unselected

**Layout:**

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onToggle}
        className={cn(
          'relative flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 transition-all hover:scale-105',
          isSelected
            ? 'border-primary bg-primary/10'
            : 'border-border/40 bg-muted/20 hover:border-border/60'
        )}
      >
        {/* Icon */}
        <model.icon className="h-3.5 w-3.5" />

        {/* Name */}
        <span className="text-[7px] font-medium">{model.name}</span>

        {/* Selection badge */}
        {isSelected && (
          <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
            <Check className="h-2.5 w-2.5 text-primary-foreground" />
          </div>
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent>
      <p className="text-xs">{model.description}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Styling:**

- Selected: `border-primary bg-primary/10` with checkmark
- Unselected: `border-border/40 bg-muted/20`
- Hover: `scale-105` transform

### 4. ModelSelectorGrid Component

**Purpose:** Grid of model cards with multi-select

**Props:**

```typescript
type ModelSelectorGridProps = {
  models: ModelDefinition[];
  selectedModelIds: string[];
  onSelectionChange: (modelIds: string[]) => void;
  columns?: number; // Default: based on model count
  maxSelections?: number; // Optional limit
};
```

**Features:**

- Responsive grid (4 or 5 columns based on model count)
- Toggle model selection on click
- Optional selection limit
- Uses reducer for state management

**Grid Layout:**

- 4 columns for image models (4 models)
- 5 columns for motion models (5 models)
- gap-1.5 between items
- max-w-xs to constrain width

**Implementation:**

```tsx
const columns = props.columns || (models.length === 5 ? 5 : 4);

<div
  className={cn(
    'grid gap-1.5 max-w-xs',
    columns === 4 && 'grid-cols-4',
    columns === 5 && 'grid-cols-5'
  )}
>
  {models.map((model) => (
    <ModelCard
      key={model.id}
      model={model}
      isSelected={selectedModelIds.includes(model.id)}
      onToggle={() => handleToggle(model.id)}
    />
  ))}
</div>;
```

**Selection Logic:**

```typescript
const handleToggle = (modelId: string) => {
  const isCurrentlySelected = selectedModelIds.includes(modelId);

  // Check max selections limit
  if (!isCurrentlySelected && maxSelections) {
    if (selectedModelIds.length >= maxSelections) {
      return; // Don't allow more selections
    }
  }

  // Toggle selection
  const newSelection = isCurrentlySelected
    ? selectedModelIds.filter((id) => id !== modelId)
    : [...selectedModelIds, modelId];

  onSelectionChange(newSelection);
};
```

### 5. Update ImagePromptTab and MotionPromptTab

**Replace placeholders from Phase 3 with:**

```tsx
// In ImagePromptTab
const [selectedImageModels, setSelectedImageModels] = useState<string[]>([
  'flux-krea',
  'nano-banana',
  'qwen',
  'seedream',
]); // Default: all selected

<div className="flex flex-col gap-4">
  {/* Textarea from Phase 3 */}
  <div className="flex flex-col gap-2">
    <label className="text-xs font-medium text-muted-foreground">
      Select Models (up to 4)
    </label>
    <ModelSelectorGrid
      models={IMAGE_MODEL_DEFINITIONS}
      selectedModelIds={selectedImageModels}
      onSelectionChange={setSelectedImageModels}
      maxSelections={4}
    />
  </div>

  <Button
    onClick={() => handleMultiGenerate('image', selectedImageModels)}
    disabled={selectedImageModels.length === 0}
    className="w-full h-9"
  >
    <Zap className="h-4 w-4 mr-2" />
    Multi-Generate ({selectedImageModels.length} models)
  </Button>
</div>;

// Similar for MotionPromptTab with 5 motion models
```

## Implementation Guidelines

### Default Selections

Start with all models selected for better UX:

```typescript
// Image models: all 4 selected by default
const [selectedImageModels, setSelectedImageModels] = useState<string[]>([
  'flux-krea',
  'nano-banana',
  'qwen',
  'seedream',
]);

// Motion models: all 5 selected by default
const [selectedMotionModels, setSelectedMotionModels] = useState<string[]>([
  'ray3',
  'seedance',
  'kling-2.5',
  'veo-3.1',
  'wan-2.5',
]);
```

### Multi-Generate Button

```tsx
<Button
  onClick={handleMultiGenerate}
  disabled={selectedModels.length === 0}
  className="w-full h-9"
>
  <Zap className="h-4 w-4 mr-2" />
  Multi-Generate ({selectedModels.length}{' '}
  {modelType === 'image' ? 'models' : 'models'})
</Button>
```

For now, `handleMultiGenerate` can just log or show a toast. Phase 6 will implement the actual regeneration panel.

### Responsive Considerations

Model cards are small (7px text) to fit in grid. Consider increasing size on mobile:

```tsx
<span className="text-[7px] md:text-[8px] font-medium">{model.name}</span>
```

## Acceptance Criteria

- [ ] Image tab shows 4 image model cards in grid
- [ ] Motion tab shows 5 motion model cards in grid
- [ ] Models can be toggled on/off
- [ ] Selected models show checkmark badge and highlighted border
- [ ] Hover tooltip displays model description
- [ ] Multi-Generate button shows selected count
- [ ] Multi-Generate button is disabled when no models selected
- [ ] Model selection respects max limit (4 for image, 5 for motion)
- [ ] All models selected by default
- [ ] Grid layout is responsive
- [ ] All Storybook stories render without errors

## Storybook Stories

### ModelCard Stories

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ModelCard } from './model-card';
import { IMAGE_MODEL_DEFINITIONS } from '@/lib/scenes/model-definitions';

const meta: Meta<typeof ModelCard> = {
  title: 'Scenes/ModelCard',
  component: ModelCard,
};

export default meta;
type Story = StoryObj<typeof ModelCard>;

export const Unselected: Story = {
  args: {
    model: IMAGE_MODEL_DEFINITIONS[0],
    isSelected: false,
    onToggle: () => {},
  },
};

export const Selected: Story = {
  args: {
    model: IMAGE_MODEL_DEFINITIONS[0],
    isSelected: true,
    onToggle: () => {},
  },
};

export const AllImageModels: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-1.5 max-w-xs">
      {IMAGE_MODEL_DEFINITIONS.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          isSelected={false}
          onToggle={() => {}}
        />
      ))}
    </div>
  ),
};
```

### ModelSelectorGrid Stories

```typescript
export const ImageModels: Story = {
  args: {
    models: IMAGE_MODEL_DEFINITIONS,
    selectedModelIds: ['flux-krea', 'qwen'],
    onSelectionChange: () => {},
  },
};

export const MotionModels: Story = {
  args: {
    models: MOTION_MODEL_DEFINITIONS,
    selectedModelIds: ['ray3', 'seedance', 'kling-2.5'],
    onSelectionChange: () => {},
  },
};

export const AllSelected: Story = {
  args: {
    models: IMAGE_MODEL_DEFINITIONS,
    selectedModelIds: IMAGE_MODEL_DEFINITIONS.map((m) => m.id),
    onSelectionChange: () => {},
  },
};

export const NoneSelected: Story = {
  args: {
    models: IMAGE_MODEL_DEFINITIONS,
    selectedModelIds: [],
    onSelectionChange: () => {},
  },
};
```

## Testing

### Manual Testing

1. Open image prompt tab
2. Click model cards to toggle selection
3. Verify checkmark appears on selected models
4. Hover over models to see tooltips
5. Check Multi-Generate button updates count
6. Try selecting more than 4 models (should be prevented)
7. Repeat for motion tab with 5 models
8. Test on mobile viewport

### Unit Tests

Test model selection reducer:

```typescript
import { describe, expect, test } from 'bun:test';
import {
  modelSelectionReducer,
  initialModelSelectionState,
} from './model-selection.reducer';

describe('modelSelectionReducer', () => {
  test('toggles model selection', () => {
    const state = modelSelectionReducer(initialModelSelectionState, {
      type: 'TOGGLE_MODEL',
      modelId: 'flux-krea',
    });
    expect(state.selectedModels).toContain('flux-krea');
  });

  test('deselects already selected model', () => {
    const state = modelSelectionReducer(
      { selectedModels: ['flux-krea', 'qwen'] },
      { type: 'TOGGLE_MODEL', modelId: 'flux-krea' }
    );
    expect(state.selectedModels).not.toContain('flux-krea');
    expect(state.selectedModels).toContain('qwen');
  });

  test('clears all selections', () => {
    const state = modelSelectionReducer(
      { selectedModels: ['flux-krea', 'qwen'] },
      { type: 'CLEAR_SELECTION' }
    );
    expect(state.selectedModels).toHaveLength(0);
  });

  test('sets selection to specific models', () => {
    const state = modelSelectionReducer(initialModelSelectionState, {
      type: 'SET_SELECTION',
      modelIds: ['ray3', 'seedance'],
    });
    expect(state.selectedModels).toEqual(['ray3', 'seedance']);
  });
});
```

## Commit Message

```
feat: add model selection grids

- Create ModelCard component with icons and selection states
- Add ModelSelectorGrid with multi-select capability
- Define image and motion model metadata with icons
- Implement model selection reducer for state management
- Update ImagePromptTab with model selector (4 models)
- Update MotionPromptTab with model selector (5 models)
- Add Multi-Generate button with selected count
- Include unit tests for reducer
- Add Storybook stories for all components
```

## Next Phase

After committing this phase, proceed to **Phase 5: Version Timeline**.

## Notes

- Model IDs should match those in `@/lib/ai/models` for actual API integration
- Multi-Generate button triggers regeneration panel (implemented in Phase 6)
- Model selection state could be persisted to localStorage later
- Icons from lucide-react match the design specs
- Small text size (7px) keeps cards compact - adjust if needed
- Tooltip provides context without cluttering UI
