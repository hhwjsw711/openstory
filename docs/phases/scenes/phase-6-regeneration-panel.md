# Phase 6: Regeneration Panel

## Objective

Build the multi-model regeneration panel that displays loading animations and allows users to compare and select from multiple AI-generated versions.

## Dependencies

- Phase 4 (model selection)
- Phase 5 (version timeline)

## Files to Create

### Components

- `src/components/scenes/regeneration-panel.tsx` - Main panel container
- `src/components/scenes/regeneration-grid.tsx` - Grid of version cards
- `src/components/scenes/regeneration-card.tsx` - Individual version card with loading
- `src/components/scenes/matrix-loader.tsx` - Matrix-style loading animation

### Utilities

- `src/lib/scenes/regeneration.reducer.ts` - Complex regeneration state management
- `src/lib/scenes/regeneration.types.ts` - Types for regeneration flow

### Stories

- `src/components/scenes/regeneration-panel.stories.tsx`
- `src/components/scenes/regeneration-card.stories.tsx`
- `src/components/scenes/matrix-loader.stories.tsx`

## Component Specifications

### 1. Regeneration Types

**File:** `src/lib/scenes/regeneration.types.ts`

```typescript
export type RegenerationType = 'image' | 'motion';

export type RegenerationVersion = {
  id: string;
  modelId: string;
  modelName: string;
  status: 'loading' | 'complete' | 'error';
  url?: string;
  error?: string;
};

export type RegenerationState = {
  isOpen: boolean;
  type: RegenerationType | null;
  frameId: string | null;
  versions: RegenerationVersion[];
  selectedVersionId: string | null;
  loadingProgress: number; // 0-100
};
```

### 2. Regeneration Reducer

**File:** `src/lib/scenes/regeneration.reducer.ts`

```typescript
export type RegenerationAction =
  | {
      type: 'OPEN_PANEL';
      frameId: string;
      modelIds: string[];
      regenerationType: RegenerationType;
    }
  | { type: 'CLOSE_PANEL' }
  | { type: 'VERSION_LOADED'; versionId: string; url: string }
  | { type: 'VERSION_ERROR'; versionId: string; error: string }
  | { type: 'SELECT_VERSION'; versionId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'UPDATE_PROGRESS'; progress: number };

export const initialRegenerationState: RegenerationState = {
  isOpen: false,
  type: null,
  frameId: null,
  versions: [],
  selectedVersionId: null,
  loadingProgress: 0,
};

export function regenerationReducer(
  state: RegenerationState,
  action: RegenerationAction
): RegenerationState {
  switch (action.type) {
    case 'OPEN_PANEL':
      return {
        ...state,
        isOpen: true,
        type: action.regenerationType,
        frameId: action.frameId,
        versions: action.modelIds.map((modelId) => ({
          id: `${action.frameId}-${modelId}-${Date.now()}`,
          modelId,
          modelName: modelId, // Would map to display name
          status: 'loading',
        })),
        selectedVersionId: null,
        loadingProgress: 0,
      };

    case 'CLOSE_PANEL':
      return initialRegenerationState;

    case 'VERSION_LOADED':
      return {
        ...state,
        versions: state.versions.map((v) =>
          v.id === action.versionId
            ? { ...v, status: 'complete', url: action.url }
            : v
        ),
      };

    case 'VERSION_ERROR':
      return {
        ...state,
        versions: state.versions.map((v) =>
          v.id === action.versionId
            ? { ...v, status: 'error', error: action.error }
            : v
        ),
      };

    case 'SELECT_VERSION':
      return {
        ...state,
        selectedVersionId: action.versionId,
      };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedVersionId: null,
      };

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        loadingProgress: action.progress,
      };

    default:
      return state;
  }
}
```

### 3. MatrixLoader Component

**Purpose:** Matrix-style falling lines animation for loading state

**Props:**

```typescript
type MatrixLoaderProps = {
  className?: string;
};
```

**Features:**

- 8 vertical lines with staggered falling animation
- Green color (#10b981)
- Spinning icon
- "LOADING..." text

**Layout:**

```tsx
<div className="relative flex h-full w-full items-center justify-center bg-black/95">
  {/* Matrix lines background */}
  <div className="absolute inset-0 overflow-hidden">
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="absolute h-full w-px bg-gradient-to-b from-transparent via-green-500 to-transparent opacity-60"
        style={{
          left: `${(i * 100) / 7}%`,
          animation: `matrix-fall ${2 + i * 0.3}s linear infinite`,
          animationDelay: `${i * 0.2}s`,
        }}
      />
    ))}
  </div>

  {/* Loading indicator */}
  <div className="relative z-10 flex flex-col items-center gap-2">
    <RotateCcw className="h-3 w-3 animate-spin text-green-500" />
    <p className="font-mono text-[8px] tracking-wider text-green-500">
      LOADING...
    </p>
  </div>
</div>
```

**Animation CSS:**

```css
@keyframes matrix-fall {
  0% {
    transform: translateY(-100%);
  }
  100% {
    transform: translateY(100%);
  }
}
```

### 4. RegenerationCard Component

**Purpose:** Single version card showing loading or result

**Props:**

```typescript
type RegenerationCardProps = {
  version: RegenerationVersion;
  versionNumber: number;
  isSelected: boolean;
  onClick: () => void;
};
```

**Features:**

- Aspect-video ratio
- Loading state with MatrixLoader (5 seconds)
- Complete state with thumbnail
- Error state with error message
- Selection indicator
- Version badge

**Layout:**

```tsx
<button
  onClick={onClick}
  disabled={version.status === 'loading'}
  className={cn(
    'relative flex aspect-video w-full flex-col items-center justify-center rounded border overflow-hidden transition-all',
    isSelected && 'ring-1 ring-foreground/40 border-foreground/40 bg-muted/60',
    version.status === 'loading' && 'cursor-wait',
    version.status === 'complete' &&
      'border-border/50 bg-muted/20 hover:border-border/70',
    version.status === 'error' && 'border-destructive/50 bg-destructive/10'
  )}
>
  {version.status === 'loading' && <MatrixLoader />}

  {version.status === 'complete' && version.url && (
    <>
      <img
        src={version.url}
        alt={`Version ${versionNumber}`}
        className="h-full w-full object-cover"
      />

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground">
          <Check className="h-2.5 w-2.5 text-background" />
        </div>
      )}
    </>
  )}

  {version.status === 'error' && (
    <div className="flex flex-col items-center gap-2 p-4 text-center">
      <AlertCircle className="h-4 w-4 text-destructive" />
      <p className="text-[10px] text-destructive">
        {version.error || 'Generation failed'}
      </p>
    </div>
  )}

  {/* Version badge (bottom-left) */}
  <div className="absolute bottom-1 left-1 rounded bg-background/80 px-1 text-[8px] font-medium">
    V{versionNumber}
  </div>
</button>
```

### 5. RegenerationGrid Component

**Purpose:** Grid layout for multiple version cards

**Props:**

```typescript
type RegenerationGridProps = {
  versions: RegenerationVersion[];
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
};
```

**Features:**

- Dynamic column count based on version count
- Gap between cards
- Responsive layout

**Grid Layout:**

```tsx
const columns = versions.length <= 4 ? 4 : versions.length === 5 ? 5 : 4;

<div
  className={cn(
    'grid gap-2 w-full',
    columns === 4 && 'grid-cols-4',
    columns === 5 && 'grid-cols-5'
  )}
>
  {versions.map((version, index) => (
    <RegenerationCard
      key={version.id}
      version={version}
      versionNumber={index + 1}
      isSelected={version.id === selectedVersionId}
      onClick={() => {
        if (version.status === 'complete') {
          onSelectVersion(version.id);
        }
      }}
    />
  ))}
</div>;
```

**Column Rules:**

- ≤4 models: 4 columns
- 5 models: 5 columns
- \>5 models: 4 columns (wrap to next row)

### 6. RegenerationPanel Component

**Purpose:** Main panel containing header, grid, and actions

**Props:**

```typescript
type RegenerationPanelProps = {
  state: RegenerationState;
  onSelect: (versionId: string) => void;
  onCancel: () => void;
};
```

**Features:**

- Header with frame label and close button
- Grid of version cards
- Action buttons (Cancel, Select)
- Loading message during generation
- Conditional rendering based on state

**Layout:**

```tsx
{
  state.isOpen && (
    <div className="mx-auto max-w-2xl rounded-lg border border-border/70 bg-background/98 p-4 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-xs font-medium text-foreground/90">
            Frame {state.frameId} -{' '}
            {state.type === 'image' ? 'Image' : 'Motion'} Generation
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {state.versions.every((v) => v.status === 'complete')
              ? 'Select a version to use'
              : 'Generating variations...'}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 w-7 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="mb-4">
        <RegenerationGrid
          versions={state.versions}
          selectedVersionId={state.selectedVersionId}
          onSelectVersion={(id) => {
            // Only allow selection when complete
            const version = state.versions.find((v) => v.id === id);
            if (version?.status === 'complete') {
              onSelect(id);
            }
          }}
        />
      </div>

      {/* Action buttons - show after loading complete */}
      {state.versions.every((v) => v.status !== 'loading') && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="h-8 flex-1 text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (state.selectedVersionId) {
                // Trigger selection handler
                // This will add the selected version to the timeline
                onSelect(state.selectedVersionId);
              }
            }}
            disabled={!state.selectedVersionId}
            className="h-8 flex-1 text-xs"
          >
            <Check className="mr-1 h-3 w-3" />
            Select Version
          </Button>
        </div>
      )}

      {/* Loading message */}
      {state.versions.some((v) => v.status === 'loading') && (
        <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <RotateCcw className="h-2.5 w-2.5 animate-spin" />
          Generating variations...
        </div>
      )}
    </div>
  );
}
```

## Implementation Guidelines

### Simulating Generation (For Demo)

For now, simulate the generation process:

```typescript
const simulateGeneration = (dispatch: React.Dispatch<RegenerationAction>) => {
  // Simulate 5 second loading
  setTimeout(() => {
    // Load each version with slight delay
    state.versions.forEach((version, index) => {
      setTimeout(() => {
        dispatch({
          type: 'VERSION_LOADED',
          versionId: version.id,
          url: `https://picsum.photos/640/360?random=${Date.now() + index}`,
        });
      }, index * 500); // Stagger by 500ms
    });
  }, 5000);
};

// Call when panel opens
useEffect(() => {
  if (state.isOpen) {
    simulateGeneration(dispatch);
  }
}, [state.isOpen]);
```

### Trigger from Multi-Generate Button (Phase 4)

Update the Multi-Generate buttons from Phase 4:

```typescript
const handleMultiGenerate = (type: RegenerationType) => {
  const selectedModels =
    type === 'image' ? selectedImageModels : selectedMotionModels;

  dispatch({
    type: 'OPEN_PANEL',
    frameId: frame.id,
    modelIds: selectedModels,
    regenerationType: type,
  });
};
```

### Replacing Version Timeline

When panel is open, replace the version timeline with the panel:

```tsx
{
  state.isOpen ? (
    <RegenerationPanel
      state={state}
      onSelect={handleSelectVersion}
      onCancel={() => dispatch({ type: 'CLOSE_PANEL' })}
    />
  ) : (
    <VersionTimeline {...timelineProps} />
  );
}
```

### Selection Flow

1. User clicks Multi-Generate
2. Panel opens with loading cards
3. After 5 seconds, cards show results
4. User clicks a card to select
5. User clicks "Select Version" button
6. New version added to timeline
7. Panel closes

## Acceptance Criteria

- [ ] Panel opens when Multi-Generate is clicked
- [ ] Grid columns adapt to model count (4 or 5 columns)
- [ ] Loading cards show matrix animation for 5 seconds
- [ ] Matrix animation has 8 falling green lines
- [ ] Loaded cards display thumbnails
- [ ] Loaded cards are clickable
- [ ] Selected card shows checkmark indicator
- [ ] Cancel button closes panel without changes
- [ ] Select button is disabled when no selection
- [ ] Select button adds chosen version to timeline
- [ ] Panel closes after selection
- [ ] Loading message displays during generation
- [ ] Action buttons appear after loading complete
- [ ] Close button (X) works
- [ ] All Storybook stories render without errors

## Storybook Stories

### MatrixLoader Stories

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { MatrixLoader } from './matrix-loader';

const meta: Meta<typeof MatrixLoader> = {
  title: 'Scenes/MatrixLoader',
  component: MatrixLoader,
};

export default meta;
type Story = StoryObj<typeof MatrixLoader>;

export const Default: Story = {
  render: () => (
    <div className="h-48 w-64 border">
      <MatrixLoader />
    </div>
  ),
};
```

### RegenerationCard Stories

```typescript
const mockVersion: RegenerationVersion = {
  id: 'v1',
  modelId: 'flux-krea',
  modelName: 'Flux Krea',
  status: 'complete',
  url: 'https://picsum.photos/640/360',
};

export const Loading: Story = {
  args: {
    version: { ...mockVersion, status: 'loading', url: undefined },
    versionNumber: 1,
    isSelected: false,
    onClick: () => {},
  },
};

export const Complete: Story = {
  args: {
    version: mockVersion,
    versionNumber: 1,
    isSelected: false,
    onClick: () => {},
  },
};

export const Selected: Story = {
  args: {
    version: mockVersion,
    versionNumber: 1,
    isSelected: true,
    onClick: () => {},
  },
};

export const Error: Story = {
  args: {
    version: {
      ...mockVersion,
      status: 'error',
      url: undefined,
      error: 'Generation failed',
    },
    versionNumber: 1,
    isSelected: false,
    onClick: () => {},
  },
};
```

### RegenerationPanel Stories

```typescript
const mockState: RegenerationState = {
  isOpen: true,
  type: 'image',
  frameId: 'frame-1',
  versions: [
    {
      id: 'v1',
      modelId: 'flux-krea',
      modelName: 'Flux Krea',
      status: 'complete',
      url: 'https://picsum.photos/640/360?v=1',
    },
    {
      id: 'v2',
      modelId: 'nano-banana',
      modelName: 'Nano Banana',
      status: 'complete',
      url: 'https://picsum.photos/640/360?v=2',
    },
    {
      id: 'v3',
      modelId: 'qwen',
      modelName: 'Qwen',
      status: 'complete',
      url: 'https://picsum.photos/640/360?v=3',
    },
    {
      id: 'v4',
      modelId: 'seedream',
      modelName: 'Seedream',
      status: 'complete',
      url: 'https://picsum.photos/640/360?v=4',
    },
  ],
  selectedVersionId: 'v2',
  loadingProgress: 100,
};

export const FourModelsComplete: Story = {
  args: {
    state: mockState,
    onSelect: () => {},
    onCancel: () => {},
  },
};

export const Loading: Story = {
  args: {
    state: {
      ...mockState,
      versions: mockState.versions.map((v) => ({
        ...v,
        status: 'loading',
        url: undefined,
      })),
      selectedVersionId: null,
    },
    onSelect: () => {},
    onCancel: () => {},
  },
};

export const FiveModels: Story = {
  args: {
    state: {
      ...mockState,
      versions: [
        ...mockState.versions,
        {
          id: 'v5',
          modelId: 'ray3',
          modelName: 'Ray3',
          status: 'complete',
          url: 'https://picsum.photos/640/360?v=5',
        },
      ],
    },
    onSelect: () => {},
    onCancel: () => {},
  },
};
```

## Testing

### Manual Testing

1. Open Storybook and verify all stories
2. Test matrix animation (should be smooth)
3. Click model cards to select
4. Verify checkmark appears on selected card
5. Test Select button enable/disable
6. Test Cancel button
7. Test close (X) button
8. Verify grid columns for 4 vs 5 models

### Unit Tests

Test regeneration reducer:

```typescript
import { describe, expect, test } from 'bun:test';
import {
  regenerationReducer,
  initialRegenerationState,
} from './regeneration.reducer';

describe('regenerationReducer', () => {
  test('opens panel with loading versions', () => {
    const state = regenerationReducer(initialRegenerationState, {
      type: 'OPEN_PANEL',
      frameId: 'frame-1',
      modelIds: ['model-1', 'model-2'],
      regenerationType: 'image',
    });

    expect(state.isOpen).toBe(true);
    expect(state.frameId).toBe('frame-1');
    expect(state.versions).toHaveLength(2);
    expect(state.versions[0].status).toBe('loading');
  });

  test('loads version with URL', () => {
    const openState = regenerationReducer(initialRegenerationState, {
      type: 'OPEN_PANEL',
      frameId: 'frame-1',
      modelIds: ['model-1'],
      regenerationType: 'image',
    });

    const versionId = openState.versions[0].id;

    const state = regenerationReducer(openState, {
      type: 'VERSION_LOADED',
      versionId,
      url: 'https://example.com/image.jpg',
    });

    expect(state.versions[0].status).toBe('complete');
    expect(state.versions[0].url).toBe('https://example.com/image.jpg');
  });

  test('selects version', () => {
    const openState = regenerationReducer(initialRegenerationState, {
      type: 'OPEN_PANEL',
      frameId: 'frame-1',
      modelIds: ['model-1'],
      regenerationType: 'image',
    });

    const versionId = openState.versions[0].id;

    const state = regenerationReducer(openState, {
      type: 'SELECT_VERSION',
      versionId,
    });

    expect(state.selectedVersionId).toBe(versionId);
  });

  test('closes panel', () => {
    const openState = regenerationReducer(initialRegenerationState, {
      type: 'OPEN_PANEL',
      frameId: 'frame-1',
      modelIds: ['model-1'],
      regenerationType: 'image',
    });

    const state = regenerationReducer(openState, {
      type: 'CLOSE_PANEL',
    });

    expect(state.isOpen).toBe(false);
    expect(state.versions).toHaveLength(0);
  });
});
```

## Commit Message

```
feat: add regeneration panel

- Create RegenerationPanel with header and actions
- Add RegenerationGrid with dynamic columns
- Implement RegenerationCard with loading/complete states
- Add MatrixLoader with falling lines animation
- Create regeneration reducer for complex state
- Integrate with Multi-Generate buttons from Phase 4
- Simulate 5-second generation for demo
- Add unit tests for reducer
- Include Storybook stories for all states
```

## Next Phase

After committing this phase, proceed to **Phase 7: Mobile UI & Final Integration**.

## Notes

- Matrix animation provides engaging loading experience
- 5-second loading is simulated; real API integration comes later
- Panel replaces version timeline when open for focused comparison
- Selection requires explicit "Select Version" button (not just clicking card)
- Grid adapts to 4 or 5 columns based on model count
- Error states handle failed generations gracefully
- Cancel provides easy exit without changes
