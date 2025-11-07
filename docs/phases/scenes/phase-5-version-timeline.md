# Phase 5: Version Timeline

## Objective

Implement the version history timeline showing past, current, and future versions of frame images/videos with visual states and version switching.

## Dependencies

- Phase 3 (scene tabs structure)

## Files to Create

### Components

- `src/components/scenes/version-timeline.tsx` - Horizontal scrollable timeline container
- `src/components/scenes/version-thumbnail.tsx` - Individual version card
- `src/components/scenes/add-version-button.tsx` - Plus button for new variations

### Utilities

- `src/lib/scenes/version-timeline.types.ts` - Version-related types and helpers

### Stories

- `src/components/scenes/version-timeline.stories.tsx`
- `src/components/scenes/version-thumbnail.stories.tsx`

## Data Model

### Version Structure

For now, we'll track versions client-side. In the future, this could be persisted to the database.

```typescript
// src/lib/scenes/version-timeline.types.ts

export type FrameVersion = {
  id: string; // Format: "{frameId}-v{versionNumber}"
  frameId: string;
  url: string;
  timestamp: Date;
  type: 'image' | 'video';
};

export type VersionTimelineState = {
  versions: FrameVersion[];
  currentVersionIndex: number;
};

/**
 * Check if version is in the past (before current)
 */
export function isVersionPast(
  versionIndex: number,
  currentIndex: number
): boolean {
  return versionIndex < currentIndex;
}

/**
 * Check if version is current
 */
export function isVersionCurrent(
  versionIndex: number,
  currentIndex: number
): boolean {
  return versionIndex === currentIndex;
}

/**
 * Check if version is in the future (after current)
 */
export function isVersionFuture(
  versionIndex: number,
  currentIndex: number
): boolean {
  return versionIndex > currentIndex;
}

/**
 * Get version number from index (1-based)
 */
export function getVersionNumber(index: number): number {
  return index + 1;
}

/**
 * Create a new version ID
 */
export function createVersionId(
  frameId: string,
  versionNumber: number
): string {
  return `${frameId}-v${versionNumber}`;
}
```

## Component Specifications

### 1. VersionThumbnail Component

**Purpose:** Display a single version with visual state indicators

**Props:**

```typescript
type VersionThumbnailProps = {
  version: FrameVersion;
  versionNumber: number;
  state: 'past' | 'current' | 'future';
  isSelected: boolean;
  onClick: () => void;
};
```

**Features:**

- Thumbnail image (80x48px)
- Version badge (top-left): "vX" format
- Selection indicator (bottom-right): 6px circle
- Visual states based on timeline position

**Layout:**

```tsx
<button
  onClick={onClick}
  className={cn(
    'relative h-12 w-20 flex-shrink-0 rounded border overflow-hidden transition-all',
    state === 'current' && 'border-primary ring-1 ring-primary/20',
    state === 'past' && 'border-border/50 opacity-60 hover:opacity-100',
    state === 'future' &&
      'border-dashed border-muted-foreground/20 opacity-40 blur-sm grayscale'
  )}
>
  {/* Thumbnail */}
  <img
    src={version.url}
    alt={`Version ${versionNumber}`}
    className="h-full w-full object-cover"
  />

  {/* Version badge (top-left) */}
  <div
    className={cn(
      'absolute top-1 left-1 rounded px-1 text-[9px] font-medium',
      isSelected
        ? 'bg-primary text-primary-foreground'
        : 'bg-background/80 text-foreground'
    )}
  >
    v{versionNumber}
  </div>

  {/* Selection indicator (bottom-right) */}
  {isSelected && (
    <div className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
  )}
</button>
```

**State Styling:**

- **Past** (before current):
  - `border-border/50`
  - `opacity-60 hover:opacity-100`
  - Normal appearance, slightly dimmed

- **Current** (selected):
  - `border-primary ring-1 ring-primary/20`
  - Full opacity
  - Selection indicator visible
  - Primary badge background

- **Future** (after current):
  - `border-dashed border-muted-foreground/20`
  - `opacity-40 blur-sm grayscale`
  - Ghosted appearance to show it's not yet reached

### 2. AddVersionButton Component

**Purpose:** Button to trigger new version generation

**Props:**

```typescript
type AddVersionButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};
```

**Layout:**

```tsx
<button
  onClick={onClick}
  disabled={disabled}
  className="flex h-12 w-14 flex-shrink-0 items-center justify-center rounded border-2 border-dashed border-muted-foreground/20 transition-all hover:border-primary/50 hover:bg-muted/30 disabled:opacity-50 disabled:cursor-not-allowed"
>
  <Plus className="h-4 w-4 text-muted-foreground" />
</button>
```

### 3. VersionTimeline Component

**Purpose:** Horizontal scrollable container for all versions

**Props:**

```typescript
type VersionTimelineProps = {
  frameId: string;
  versions: FrameVersion[];
  currentVersionIndex: number;
  onVersionSelect: (versionIndex: number) => void;
  onAddVersion: () => void;
  sceneNumber?: number;
};
```

**Features:**

- Horizontal scrollable layout
- Version count info text
- Connector lines between versions
- Add button at end
- Auto-scroll to current version

**Layout:**

```tsx
<div className="flex flex-col gap-2">
  {/* Info text */}
  <p className="text-[10px] text-muted-foreground">
    Scene {sceneNumber} - {versions.length} version(s) generated
  </p>

  {/* Timeline container */}
  <div className="flex items-center gap-1.5 overflow-x-auto rounded-md border border-border/50 bg-muted/20 p-1.5">
    {versions.map((version, index) => {
      const state = isVersionCurrent(index, currentVersionIndex)
        ? 'current'
        : isVersionPast(index, currentVersionIndex)
          ? 'past'
          : 'future';

      return (
        <React.Fragment key={version.id}>
          <VersionThumbnail
            version={version}
            versionNumber={getVersionNumber(index)}
            state={state}
            isSelected={index === currentVersionIndex}
            onClick={() => onVersionSelect(index)}
          />

          {/* Connector line */}
          {index < versions.length - 1 && (
            <div
              className={cn(
                'h-px w-3 flex-shrink-0',
                index < currentVersionIndex ? 'bg-primary' : 'bg-border/50'
              )}
            />
          )}
        </React.Fragment>
      );
    })}

    {/* Add version button */}
    <AddVersionButton onClick={onAddVersion} />
  </div>
</div>
```

**Auto-scroll to current version:**

```typescript
const timelineRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (timelineRef.current) {
    const currentThumbnail = timelineRef.current.querySelector(
      `[data-version-index="${currentVersionIndex}"]`
    );
    if (currentThumbnail) {
      currentThumbnail.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }
}, [currentVersionIndex]);
```

## Implementation Guidelines

### Version Management in Parent Component

The timeline displays versions but doesn't manage them. Parent component handles state:

```typescript
const [versions, setVersions] = useState<FrameVersion[]>([
  {
    id: createVersionId(frame.id, 1),
    frameId: frame.id,
    url: frame.thumbnailUrl || '',
    timestamp: new Date(),
    type: 'image',
  },
]);

const [currentVersionIndex, setCurrentVersionIndex] = useState(0);

const handleVersionSelect = (index: number) => {
  setCurrentVersionIndex(index);
  // Update frame.thumbnailUrl or videoUrl based on selected version
  // This could trigger an API update or just local state change
};

const handleAddVersion = () => {
  // This will eventually trigger the regeneration panel (Phase 6)
  // For now, just simulate adding a version
  const newVersion: FrameVersion = {
    id: createVersionId(frame.id, versions.length + 1),
    frameId: frame.id,
    url: 'https://picsum.photos/320/180?random=' + Date.now(),
    timestamp: new Date(),
    type: 'image',
  };

  setVersions([...versions, newVersion]);
  setCurrentVersionIndex(versions.length); // Select new version
};
```

### Connector Lines

Lines between versions show progress:

- **Primary color** for connections up to current version
- **Border color** for connections after current version

### Empty State

If no versions exist yet (shouldn't happen normally):

```tsx
{versions.length === 0 ? (
  <div className="text-xs text-muted-foreground">
    No versions generated yet
  </div>
) : (
  <VersionTimeline ... />
)}
```

### Responsive Design

Timeline scrolls horizontally on all viewport sizes:

```tsx
<div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
  {/* Timeline content */}
</div>
```

## Acceptance Criteria

- [ ] Timeline displays all versions horizontally
- [ ] Current version has highlighted border and indicator dot
- [ ] Past versions have normal opacity
- [ ] Future versions have reduced opacity, dashed border, blur
- [ ] Clicking version switches to it
- [ ] Connector lines appear between versions
- [ ] Connector lines use correct colors (past = primary, future = border)
- [ ] Add button appears at end of timeline
- [ ] Clicking add button triggers callback (for Phase 6)
- [ ] Version count displays correctly
- [ ] Timeline scrolls horizontally when needed
- [ ] Auto-scroll to current version works
- [ ] All Storybook stories render without errors

## Storybook Stories

### VersionThumbnail Stories

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { VersionThumbnail } from './version-thumbnail';

const meta: Meta<typeof VersionThumbnail> = {
  title: 'Scenes/VersionThumbnail',
  component: VersionThumbnail,
};

export default meta;
type Story = StoryObj<typeof VersionThumbnail>;

const mockVersion: FrameVersion = {
  id: 'frame-1-v1',
  frameId: 'frame-1',
  url: 'https://picsum.photos/320/180',
  timestamp: new Date(),
  type: 'image',
};

export const Past: Story = {
  args: {
    version: mockVersion,
    versionNumber: 1,
    state: 'past',
    isSelected: false,
    onClick: () => {},
  },
};

export const Current: Story = {
  args: {
    version: mockVersion,
    versionNumber: 2,
    state: 'current',
    isSelected: true,
    onClick: () => {},
  },
};

export const Future: Story = {
  args: {
    version: mockVersion,
    versionNumber: 3,
    state: 'future',
    isSelected: false,
    onClick: () => {},
  },
};
```

### VersionTimeline Stories

```typescript
const mockVersions: FrameVersion[] = [
  {
    id: 'frame-1-v1',
    frameId: 'frame-1',
    url: 'https://picsum.photos/320/180?v=1',
    timestamp: new Date(Date.now() - 3600000),
    type: 'image',
  },
  {
    id: 'frame-1-v2',
    frameId: 'frame-1',
    url: 'https://picsum.photos/320/180?v=2',
    timestamp: new Date(Date.now() - 1800000),
    type: 'image',
  },
  {
    id: 'frame-1-v3',
    frameId: 'frame-1',
    url: 'https://picsum.photos/320/180?v=3',
    timestamp: new Date(),
    type: 'image',
  },
];

export const MultipleVersions: Story = {
  args: {
    frameId: 'frame-1',
    versions: mockVersions,
    currentVersionIndex: 1, // Middle version selected
    onVersionSelect: () => {},
    onAddVersion: () => {},
    sceneNumber: 3,
  },
};

export const FirstVersion: Story = {
  args: {
    frameId: 'frame-1',
    versions: mockVersions,
    currentVersionIndex: 0,
    onVersionSelect: () => {},
    onAddVersion: () => {},
    sceneNumber: 1,
  },
};

export const LastVersion: Story = {
  args: {
    frameId: 'frame-1',
    versions: mockVersions,
    currentVersionIndex: 2,
    onVersionSelect: () => {},
    onAddVersion: () => {},
    sceneNumber: 5,
  },
};

export const SingleVersion: Story = {
  args: {
    frameId: 'frame-1',
    versions: [mockVersions[0]],
    currentVersionIndex: 0,
    onVersionSelect: () => {},
    onAddVersion: () => {},
    sceneNumber: 1,
  },
};
```

## Testing

### Manual Testing

1. Open Storybook and verify all stories
2. Click different versions to select them
3. Verify visual states (past, current, future)
4. Check connector lines use correct colors
5. Click add button and verify callback
6. Test horizontal scrolling with many versions
7. Verify auto-scroll to current version

### Unit Tests

Test helper functions:

```typescript
import { describe, expect, test } from 'bun:test';
import {
  isVersionPast,
  isVersionCurrent,
  isVersionFuture,
  getVersionNumber,
  createVersionId,
} from './version-timeline.types';

describe('version timeline helpers', () => {
  test('identifies past version', () => {
    expect(isVersionPast(0, 2)).toBe(true);
    expect(isVersionPast(2, 2)).toBe(false);
  });

  test('identifies current version', () => {
    expect(isVersionCurrent(2, 2)).toBe(true);
    expect(isVersionCurrent(1, 2)).toBe(false);
  });

  test('identifies future version', () => {
    expect(isVersionFuture(3, 2)).toBe(true);
    expect(isVersionFuture(1, 2)).toBe(false);
  });

  test('gets 1-based version number', () => {
    expect(getVersionNumber(0)).toBe(1);
    expect(getVersionNumber(4)).toBe(5);
  });

  test('creates version ID', () => {
    expect(createVersionId('frame-123', 1)).toBe('frame-123-v1');
    expect(createVersionId('frame-123', 5)).toBe('frame-123-v5');
  });
});
```

## Commit Message

```
feat: add version timeline

- Create VersionTimeline component with horizontal scroll
- Add VersionThumbnail with past/current/future states
- Implement AddVersionButton for new variations
- Add connector lines between versions
- Create version helper utilities and types
- Include auto-scroll to current version
- Add unit tests for helper functions
- Include Storybook stories for all states
```

## Next Phase

After committing this phase, proceed to **Phase 6: Regeneration Panel**.

## Notes

- Version data is client-side for now; can be persisted later
- Future versions show ghosted appearance to indicate they're not accessible yet
- This is a timeline visualization, not a history scrubber (no drag-to-seek)
- Auto-scroll ensures current version is always visible
- Connector lines provide visual continuity between versions
- Add button will trigger regeneration panel in Phase 6
