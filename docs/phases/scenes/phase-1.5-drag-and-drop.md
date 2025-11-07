# Phase 1.5: Drag-and-Drop Scene Reordering

## Objective

Add desktop-only drag-and-drop reordering to the existing scene list components, allowing users to reorder scenes visually with optimistic updates.

## Dependencies

- Phase 1 (Scene List Components - Read-Only)
- @dnd-kit packages (already installed)

## Files to Modify

This phase modifies existing components created in Phase 1:

- `src/components/scenes/scene-list-item.tsx` - Add drag handle
- `src/components/scenes/scene-list.tsx` - Integrate @dnd-kit sortable
- `src/components/scenes/scene-list-item.stories.tsx` - Add drag story variant
- `src/components/scenes/scene-list.stories.tsx` - Add draggable story variant

## Implementation Details

### 1. Update SceneListItem Component

**Add Drag Handle:**

- Add `dragHandleProps` to component props (optional)
- Add GripVertical icon at start of card
- Desktop only: `hidden md:block`
- Styling: `cursor-grab active:cursor-grabbing`

**Updated Props:**

```typescript
type SceneListItemProps = {
  frame: Frame;
  isActive: boolean;
  isCompleted: boolean;
  onSelect: () => void;
  onToggleComplete: () => void;
  dragHandleProps?: any; // For @dnd-kit sortable
};
```

**Layout Update:**

```tsx
<div className="flex items-start gap-3">
  {/* Drag handle - desktop only */}
  <div
    {...dragHandleProps?.attributes}
    {...dragHandleProps?.listeners}
    className="hidden md:block cursor-grab active:cursor-grabbing pt-2"
  >
    <GripVertical className="h-4 w-4 text-muted-foreground" />
  </div>

  {/* Rest of existing layout */}
  <SceneThumbnail {...} />
  {/* ... */}
</div>
```

### 2. Create Sortable Wrapper Component

**Purpose:** Wrap SceneListItem with @dnd-kit sortable functionality

**File:** `src/components/scenes/sortable-scene-item.tsx` (new file)

```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Frame } from '@/types/database';
import { SceneListItem } from './scene-list-item';

type SortableSceneItemProps = {
  frame: Frame;
  isActive: boolean;
  isCompleted: boolean;
  onSelect: () => void;
  onToggleComplete: () => void;
};

export function SortableSceneItem({
  frame,
  isActive,
  isCompleted,
  onSelect,
  onToggleComplete,
}: SortableSceneItemProps) {
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
      <SceneListItem
        frame={frame}
        isActive={isActive}
        isCompleted={isCompleted}
        onSelect={onSelect}
        onToggleComplete={onToggleComplete}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}
```

### 3. Update SceneList Component

**Add @dnd-kit Integration:**

```tsx
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useReorderFrames } from '@/hooks/use-frames';
import { SortableSceneItem } from './sortable-scene-item';

export function SceneList({
  sequenceId,
  selectedFrameId,
  onSelectFrame,
  completedFrameIds,
  onToggleComplete,
}: SceneListProps) {
  const { data: frames, isLoading } = useFramesBySequence(sequenceId);
  const reorderFrames = useReorderFrames();

  // Configure drag sensors (desktop only)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = frames.findIndex((f) => f.id === active.id);
    const newIndex = frames.findIndex((f) => f.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistic update via mutation
    reorderFrames.mutate({
      sequenceId,
      frameId: active.id as string,
      newIndex,
    });
  };

  if (isLoading) {
    return <SceneListSkeleton />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={frames.map((f) => f.id)}
        strategy={verticalListSortingStrategy}
      >
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-2 p-4">
            {frames.map((frame) => (
              <SortableSceneItem
                key={frame.id}
                frame={frame}
                isActive={selectedFrameId === frame.id}
                isCompleted={completedFrameIds.has(frame.id)}
                onSelect={() => onSelectFrame(frame.id)}
                onToggleComplete={() => onToggleComplete(frame.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </SortableContext>
    </DndContext>
  );
}
```

### 4. Update Storybook Stories

**SceneListItem Stories:**

Add a new story showing the drag handle:

```typescript
export const WithDragHandle: Story = {
  args: {
    frame: mockFrame,
    isActive: false,
    isCompleted: false,
    onSelect: () => {},
    onToggleComplete: () => {},
    dragHandleProps: {
      attributes: {},
      listeners: {},
    },
  },
};
```

**SceneList Stories:**

Update existing stories to show draggable behavior:

```typescript
export const DraggableScenes: Story = {
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
        // Mock frames API with multiple scenes
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen w-80">
        <Story />
      </div>
    ),
  ],
};
```

## API Integration

**Existing Hook:** `useReorderFrames` from `@/hooks/use-frames`

This hook already exists and expects:

```typescript
reorderFrames.mutate({
  sequenceId: string,
  frameId: string,
  newIndex: number,
});
```

**API Endpoint:** `/api/sequences/{sequenceId}/frames/reorder`

This endpoint should already exist from Phase 0. Verify it handles:

- Accepts `POST` with `{ frameId, newIndex }`
- Updates `orderIndex` for affected frames
- Returns updated frames array
- Invalidates `useFramesBySequence` cache

## Acceptance Criteria

- [ ] Drag handle visible on desktop (`hidden md:block`)
- [ ] Drag handle hidden on mobile
- [ ] Scenes can be reordered by dragging (desktop only)
- [ ] Drag requires 8px movement before activating (prevents accidental drags)
- [ ] Dragging scene shows 50% opacity
- [ ] Optimistic UI update on drop
- [ ] API call updates frame order in database
- [ ] Scene list re-renders with new order
- [ ] Cursor changes to `grab` on hover, `grabbing` when dragging
- [ ] Storybook stories show drag handle correctly
- [ ] No TypeScript errors
- [ ] No lint errors

## Manual Testing

1. Open scenes page on desktop
2. Hover over scene - should see drag handle (GripVertical icon)
3. Try to drag a scene - should require slight movement before dragging
4. Drag scene to new position
5. Drop scene - should update order immediately (optimistic)
6. Verify order persists after page refresh
7. Resize to mobile - drag handle should be hidden
8. Mobile: scenes should still be clickable to select (no dragging)

## Commit Message

```
feat: add drag-and-drop scene reordering (Phase 1.5)

- Add drag handle to SceneListItem (desktop only)
- Create SortableSceneItem wrapper with @dnd-kit
- Integrate DndContext into SceneList component
- Wire up useReorderFrames hook for persistence
- Add drag handle stories to Storybook
- 8px activation distance to prevent accidental drags
- Optimistic UI updates on reorder
```

## Next Phase

After committing this phase, proceed to **Phase 2: Image Preview & Video Controls**.

## Notes

- Drag-and-drop is desktop-only for better touch UX
- Mobile users can still view and select scenes (no reordering on mobile)
- Activation constraint (8px) prevents accidental drags when clicking to select
- Optimistic updates make the UX feel instant
- `useReorderFrames` hook handles API call and cache invalidation automatically
- SortableSceneItem wrapper keeps SceneListItem clean and reusable
