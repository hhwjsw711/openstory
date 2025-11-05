# Phase 1: Scene List Components

## Objective

Create the scene list sidebar for desktop and bottom sheet for mobile, including drag-and-drop reordering, scene thumbnails, and completion tracking.

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
import { useFramesBySequence } from '@/lib/api/frames';
// Returns: { data: Frame[], isLoading, error }
```

### Types

```typescript
import type { Frame } from '@/types/database';
// Frame includes: id, sequenceId, metadata (Scene), thumbnailUrl, videoUrl, thumbnailStatus, videoStatus
```

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
  isCompleted: boolean;
  onSelect: () => void;
  onToggleComplete: () => void;
  dragHandleProps?: any; // For @dnd-kit
};
```

**Layout:**

- Drag handle (desktop only) - GripVertical icon
- Thumbnail (80x45px)
- Scene number badge (e.g., "1", "2", "3")
- Heading (from frame.metadata.metadata.title)
- Script preview (from frame.metadata.originalScript.extract) - 2 lines max
- Completion checkbox (circular button)

**Styling:**

- Active scene: `bg-primary/10 border-primary`
- Inactive: `bg-muted/50 border-border/50 hover:bg-muted/70`
- Completed checkbox: green background with check icon
- Drag handle: only visible on desktop (`hidden md:block`)

**Responsive:**

- Desktop: Show drag handle, smaller text
- Mobile: Hide drag handle, slightly larger touch targets

### 3. SceneList Component

**Purpose:** Container for all scene items with drag-and-drop

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

- Fetch frames using `useFramesBySequence(sequenceId)`
- Drag-and-drop reordering (desktop only) using @dnd-kit
- Scrollable list with ScrollArea
- Loading state with skeleton items
- Empty state if no frames

**Desktop Layout:**

- Fixed width: 320px
- Full height with scroll
- Editable story title at top
- "Scenes" label
- Action buttons at bottom: "Generate ALL Motion", "Add Scene"

**Mobile:**

- Not rendered (use MobileSceneSheet instead)
- Hidden with `hidden md:block`

**Drag-and-Drop Setup:**

```typescript
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
```

**Reordering:**

- On drag end, calculate new order
- Call API to update frame order (we'll need to create this mutation)
- Optimistic UI update

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

Use a Set to track completed frame IDs:

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

### Drag Handle with @dnd-kit

```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableSceneItem({ frame, ...props }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: frame.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        className="hidden md:block cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      {/* Rest of card */}
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Desktop scene list displays all frames in order
- [ ] Drag-and-drop reordering works on desktop
- [ ] Scene thumbnails show loading state when generating
- [ ] Active scene is visually highlighted
- [ ] Completion checkboxes toggle correctly
- [ ] Mobile bottom sheet opens and displays scenes
- [ ] Clicking scene on mobile closes sheet and selects scene
- [ ] No drag handle visible on mobile
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
feat: add scene list components with drag-and-drop

- Create SceneList component with drag-and-drop reordering
- Add SceneListItem with thumbnails and completion tracking
- Implement SceneThumbnail with loading states
- Add MobileSceneSheet for mobile navigation
- Include Storybook stories for all components
- Use CSS-only responsive design (no JS hooks)
```

## Next Phase

After committing this phase, proceed to **Phase 2: Image Preview & Video Controls**.

## Notes

- Drag-and-drop is desktop-only for better touch UX
- Completion state is client-side only for now (can persist later)
- Scene ordering mutation may need to be added to API hooks
- Mobile sheet auto-closes on selection for smoother UX
