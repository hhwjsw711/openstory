# Phase 1: Scene List Components (Read-Only)

## Objective

Create the scene list sidebar for desktop and bottom sheet for mobile, including scene thumbnails, selection, and completion tracking. **Drag-and-drop reordering is deferred to Phase 1.5.**

## Dependencies

- Phase 0 (foundation and directory structure)

## Files to Create

### Components

- `src/components/scenes/scene-list.tsx` - Desktop sidebar scene list container
- `src/components/scenes/scene-list-item.tsx` - Individual scene card component
- `src/components/scenes/scene-thumbnail.tsx` - Scene thumbnail with loading states
- `src/components/scenes/mobile-scene-sheet.tsx` - Mobile bottom sheet for scene navigation

### Stories

- `src/components/scenes/scene-list-item.stories.tsx`
- `src/components/scenes/scene-thumbnail.stories.tsx`
- `src/components/scenes/scene-list.stories.tsx`

## Existing APIs to Use

### TanStack Query Hooks

```typescript
import { useFramesBySequence } from '@/hooks/use-frames';
// Returns: { data: Frame[], isLoading, error }
```

### Types

```typescript
import type { Frame } from '@/types/database';
// Frame includes:
// - id, sequenceId, orderIndex
// - metadata (Scene object with title, prompts, etc.)
// - thumbnailUrl, thumbnailStatus ('pending' | 'generating' | 'completed' | 'failed')
// - videoUrl, videoStatus ('pending' | 'generating' | 'completed' | 'failed')
// - thumbnailError, videoError (error messages if failed)
```

### Reference Implementation

See existing storyboard components for patterns:

- `src/components/sequence/storyboard-frame-with-script.tsx` - Status checking (lines 98-119)
- `src/components/sequence/storyboard-frame.tsx` - Basic frame card with drag-and-drop

## Component Specifications

### 1. SceneThumbnail Component

**Purpose:** Display frame thumbnail with loading/error states

**Props:**

```typescript
type SceneThumbnailProps = {
  thumbnailUrl?: string | null;
  thumbnailStatus?: 'pending' | 'generating' | 'complete' | 'failed';
  alt: string;
  className?: string;
};
```

**Features:**

- Show thumbnail image when available
- Show Skeleton when generating or pending
- Show error state if failed
- Aspect ratio: 16:9 (aspect-video)
- Object-fit: cover

**States:**

- Loading: `<Skeleton className="aspect-video" />`
- Complete: `<Image src={thumbnailUrl} alt={alt} />`
- Failed: Error icon with retry option

### 2. SceneListItem Component

**Purpose:** Individual scene card in the list

**Props:**

```typescript
type SceneListItemProps = {
  frame: Frame;
  isActive: boolean;
  isCompleted: boolean; // Computed from frame status + manual completion state
  onSelect: () => void;
  onToggleComplete: () => void;
};
```

**Computing `isCompleted` prop:**

```typescript
const isCompleted = (frame: Frame, completedFrameIds: Set<string>) => {
  const isFullyGenerated =
    frame.thumbnailStatus === 'completed' &&
    frame.videoStatus === 'completed';
  const isManuallyMarked = completedFrameIds.has(frame.id);
  return isFullyGenerated || isManuallyMarked;
};

// Usage:
<SceneListItem
  frame={frame}
  isCompleted={isCompleted(frame, completedFrameIds)}
  // ...
/>
```

**Layout:**

- Thumbnail (80x45px)
- Scene number badge (e.g., "1", "2", "3")
- Heading (from frame.metadata.metadata.title)
- Script preview (from frame.metadata.originalScript.extract) - 2 lines max
- Completion checkbox (circular button)

**Styling:**

- Active scene: `bg-primary/10 border-primary`
- Inactive: `bg-muted/50 border-border/50 hover:bg-muted/70`
- Completed checkbox: green background with check icon
- Clickable card for selection

**Responsive:**

- Mobile: Slightly larger touch targets for better UX

### 3. SceneList Component

**Purpose:** Container for all scene items

**Props:**

```typescript
type SceneListProps = {
  sequenceId: string;
  selectedFrameId: string | null;
  onSelectFrame: (frameId: string) => void;
  completedFrameIds: Set<string>;
  onToggleComplete: (frameId: string) => void;
};
```

**Features:**

- Fetch frames using `useFramesBySequence(sequenceId)` from `@/hooks/use-frames`
- Scrollable list with ScrollArea
- Loading state with skeleton items
- Empty state if no frames
- Simple ordered list (reordering comes in Phase 1.5)

**Desktop Layout:**

- Fixed width: 320px
- Full height with scroll
- Editable story title at top
- "Scenes" label

**Mobile:**

- Not rendered (use MobileSceneSheet instead)
- Hidden with `hidden md:block`

**Note:** Drag-and-drop reordering will be added in Phase 1.5.

### 4. MobileSceneSheet Component

**Purpose:** Bottom sheet for mobile scene navigation

**Props:**

```typescript
type MobileSceneSheetProps = {
  frames: Frame[];
  selectedFrameId: string | null;
  onSelectFrame: (frameId: string) => void;
  completedFrameIds: Set<string>;
  onToggleComplete: (frameId: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};
```

**Features:**

- Sheet component from shadcn/ui
- 70vh height
- Scene count header
- Scene list (non-draggable)
- Clicking scene selects it and closes sheet

**Mobile Only:**

- Shown only on mobile: `block md:hidden`

## Implementation Guidelines

### Responsive Design (CSS-only)

```tsx
// Desktop scene list
<div className="hidden md:block md:w-80 ...">
  <SceneList ... />
</div>

// Mobile trigger
<div className="block md:hidden ...">
  <Sheet>
    <SheetTrigger>...</SheetTrigger>
    <SheetContent>
      <MobileSceneSheet ... />
    </SheetContent>
  </Sheet>
</div>
```

### Completion State

**Determining Frame Completion:**

A frame is considered "completed" when BOTH thumbnail and video are fully generated:

```typescript
// Check frame generation status from database fields
const isThumbnailComplete = frame.thumbnailStatus === 'completed';
const isVideoComplete = frame.videoStatus === 'completed';

// Frame is fully completed when both image and video are done
const isFrameComplete = isThumbnailComplete && isVideoComplete;
```

**Status field values:**

- `frame.thumbnailStatus`: `'pending' | 'generating' | 'completed' | 'failed'`
- `frame.videoStatus`: `'pending' | 'generating' | 'completed' | 'failed'`

**Client-side completion tracking:**

Use a Set to track manually completed frame IDs (for UI-only "mark as done" feature):

```typescript
const [completedFrameIds, setCompletedFrameIds] = useState<Set<string>>(
  new Set()
);

const handleToggleComplete = (frameId: string) => {
  setCompletedFrameIds((prev) => {
    const next = new Set(prev);
    if (next.has(frameId)) {
      next.delete(frameId);
    } else {
      next.add(frameId);
    }
    return next;
  });
};
```

**Visual completion logic:**

```typescript
// Combine database status + manual completion for visual state
const isCompleted = (frame: Frame, completedFrameIds: Set<string>) => {
  const isFullyGenerated =
    frame.thumbnailStatus === 'completed' && frame.videoStatus === 'completed';
  const isManuallyMarked = completedFrameIds.has(frame.id);

  // Frame is "complete" if either fully generated OR manually marked
  return isFullyGenerated || isManuallyMarked;
};
```

## Acceptance Criteria

- [ ] Desktop scene list displays all frames in order
- [ ] Scene thumbnails show loading state when generating
- [ ] Active scene is visually highlighted
- [ ] Completion checkboxes toggle correctly
- [ ] Clicking a scene selects it
- [ ] Mobile bottom sheet opens and displays scenes
- [ ] Clicking scene on mobile closes sheet and selects scene
- [ ] Responsive breakpoint at 768px works correctly
- [ ] All Storybook stories render without errors

## Storybook Stories

### SceneThumbnail Stories

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { SceneThumbnail } from './scene-thumbnail';

const meta: Meta<typeof SceneThumbnail> = {
  title: 'Scenes/SceneThumbnail',
  component: SceneThumbnail,
};

export default meta;
type Story = StoryObj<typeof SceneThumbnail>;

export const Loading: Story = {
  args: {
    thumbnailStatus: 'generating',
    alt: 'Scene 1',
  },
};

export const Complete: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/320/180',
    thumbnailStatus: 'complete',
    alt: 'Scene 1',
  },
};

export const Failed: Story = {
  args: {
    thumbnailStatus: 'failed',
    alt: 'Scene 1',
  },
};
```

### SceneListItem Stories

```typescript
export const Active: Story = {
  args: {
    frame: mockFrame,
    isActive: true,
    isCompleted: false,
    onSelect: () => {},
    onToggleComplete: () => {},
  },
};

export const Inactive: Story = {
  args: {
    frame: mockFrame,
    isActive: false,
    isCompleted: false,
    onSelect: () => {},
    onToggleComplete: () => {},
  },
};

export const Completed: Story = {
  args: {
    frame: mockFrame,
    isActive: false,
    isCompleted: true,
    onSelect: () => {},
    onToggleComplete: () => {},
  },
};

export const Generating: Story = {
  args: {
    frame: { ...mockFrame, thumbnailStatus: 'generating' },
    isActive: false,
    isCompleted: false,
    onSelect: () => {},
    onToggleComplete: () => {},
  },
};
```

### SceneList Stories

```typescript
export const WithScenes: Story = {
  args: {
    sequenceId: '123',
    selectedFrameId: 'frame-1',
    onSelectFrame: () => {},
    completedFrameIds: new Set(['frame-2']),
    onToggleComplete: () => {},
  },
  parameters: {
    msw: {
      handlers: [
        // Mock API response
      ],
    },
  },
};

export const Loading: Story = {
  // Show loading skeleton state
};

export const Empty: Story = {
  // Show empty state
};
```

## Testing

### Manual Testing

1. Navigate to scenes route
2. Verify scene list renders with thumbnails
3. Try dragging scenes (desktop)
4. Toggle completion checkboxes
5. Click scenes to select
6. Resize browser to test mobile breakpoint
7. Open mobile sheet and select scene

### Unit Tests

Test completion state management logic separately in a utility file.

## Commit Message

```
feat: add scene list components (read-only)

- Create SceneList component with scrollable scene display
- Add SceneListItem with thumbnails and completion tracking
- Implement SceneThumbnail with loading states
- Add MobileSceneSheet for mobile navigation
- Include Storybook stories for all components
- Use CSS-only responsive design (no JS hooks)
- Drag-and-drop reordering deferred to Phase 1.5
```

## Next Phase

After committing this phase, proceed to **Phase 1.5: Drag-and-Drop Reordering**.

## Notes

- **Completion state**: Uses database status fields (`thumbnailStatus` and `videoStatus`) to determine if frames are fully generated, plus optional client-side manual "mark as done" tracking
- A frame is considered fully complete when both `thumbnailStatus === 'completed'` AND `videoStatus === 'completed'`
- Mobile sheet auto-closes on selection for smoother UX
- Drag-and-drop reordering functionality moved to Phase 1.5
- Using existing `useFramesBySequence` hook from `@/hooks/use-frames`
- Frame metadata contains complete Scene object for rendering titles/descriptions
- See `storyboard-frame-with-script.tsx` for reference implementation of status checking (lines 98-119)
