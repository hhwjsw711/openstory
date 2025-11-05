# Phase 3: Scene Details Tabs

## Objective

Implement the tabbed interface for viewing and editing scene content: script, image prompt, and motion prompt. This phase focuses on the tabs without model selection (that comes in Phase 4).

## Dependencies

- Phase 0 (foundation)
- Phase 1 (scene selection state)
- Phase 2 (can be built in parallel)

## Files to Create

### Components

- `src/components/scenes/scene-details-tabs.tsx` - Main tabs container
- `src/components/scenes/script-tab.tsx` - Script editing tab
- `src/components/scenes/image-prompt-tab.tsx` - Image prompt tab (no models yet)
- `src/components/scenes/motion-prompt-tab.tsx` - Motion prompt tab (no models yet)

### Utilities

- `src/lib/scenes/scene-content.ts` - Helper functions to extract data from Scene metadata

### Stories

- `src/components/scenes/scene-details-tabs.stories.tsx`

## Existing APIs to Use

### TanStack Query Hooks

```typescript
import { useUpdateFrame } from '@/lib/api/frames';
// Optimistic updates for frame metadata
```

### Types

```typescript
import type { Frame } from '@/types/database';
import type { Scene } from '@/lib/ai/scene-analysis.schema';
// Frame.metadata contains the Scene object
```

### Services

```typescript
import { frameService } from '@/lib/services/frame.service';
// frameService.getSceneData(frame) - Returns Scene from metadata
// frameService.getVisualPrompt(frame) - Returns visual prompt
// frameService.getMotionPrompt(frame) - Returns motion prompt
```

## Component Specifications

### 1. Helper Utilities

**File:** `src/lib/scenes/scene-content.ts`

```typescript
import type { Frame } from '@/types/database';
import type { Scene } from '@/lib/ai/scene-analysis.schema';

/**
 * Extract scene title from frame metadata
 */
export function getSceneTitle(frame: Frame): string {
  const scene = frame.metadata as Scene;
  return scene?.metadata?.title || 'Untitled Scene';
}

/**
 * Extract scene script/description
 */
export function getSceneScript(frame: Frame): string {
  const scene = frame.metadata as Scene;
  return scene?.originalScript?.extract || '';
}

/**
 * Extract visual/image prompt
 */
export function getImagePrompt(frame: Frame): string {
  const scene = frame.metadata as Scene;
  return scene?.prompts?.visual?.fullPrompt || '';
}

/**
 * Extract motion prompt
 */
export function getMotionPrompt(frame: Frame): string {
  const scene = frame.metadata as Scene;
  return scene?.prompts?.motion?.fullPrompt || '';
}

/**
 * Update scene metadata with new script
 */
export function updateSceneScript(frame: Frame, newScript: string): Scene {
  const scene = frame.metadata as Scene;
  return {
    ...scene,
    originalScript: {
      ...scene.originalScript,
      extract: newScript,
    },
  };
}

/**
 * Update scene metadata with new image prompt
 */
export function updateImagePrompt(frame: Frame, newPrompt: string): Scene {
  const scene = frame.metadata as Scene;
  return {
    ...scene,
    prompts: {
      ...scene.prompts,
      visual: {
        ...scene.prompts.visual,
        fullPrompt: newPrompt,
      },
    },
  };
}

/**
 * Update scene metadata with new motion prompt
 */
export function updateMotionPrompt(frame: Frame, newPrompt: string): Scene {
  const scene = frame.metadata as Scene;
  return {
    ...scene,
    prompts: {
      ...scene.prompts,
      motion: {
        ...scene.prompts.motion,
        fullPrompt: newPrompt,
      },
    },
  };
}
```

### 2. ScriptTab Component

**Purpose:** Display and edit scene script/description

**Props:**

```typescript
type ScriptTabProps = {
  frame: Frame;
  onUpdate: (updates: Partial<Frame>) => void;
};
```

**Features:**

- Label: "Scene Description"
- Textarea with script content
- Auto-resize (min-height: 80px)
- Updates on blur or with debounce
- Placeholder: "Describe what happens in this scene…"

**Layout:**

```tsx
<div className="flex flex-col gap-2">
  <label className="text-xs font-medium text-muted-foreground">
    Scene Description
  </label>
  <Textarea
    value={script}
    onChange={handleChange}
    onBlur={handleBlur}
    placeholder="Describe what happens in this scene…"
    className="min-h-[80px] resize-y text-sm"
  />
</div>
```

**Update Logic:**

```typescript
const handleBlur = () => {
  const updatedMetadata = updateSceneScript(frame, script);
  onUpdate({ metadata: updatedMetadata });
};
```

### 3. ImagePromptTab Component

**Purpose:** Display and edit image generation prompt (model selection comes in Phase 4)

**Props:**

```typescript
type ImagePromptTabProps = {
  frame: Frame;
  onUpdate: (updates: Partial<Frame>) => void;
};
```

**Features:**

- Label: "Image Prompt"
- Textarea with image prompt
- Placeholder: "Detailed description for image generation…"
- Placeholder for model selector grid (will be added in Phase 4)

**Layout:**

```tsx
<div className="flex flex-col gap-4">
  <div className="flex flex-col gap-2">
    <label className="text-xs font-medium text-muted-foreground">
      Image Prompt
    </label>
    <Textarea
      value={imagePrompt}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="Detailed description for image generation…"
      className="min-h-[80px] resize-y text-sm"
    />
  </div>

  {/* Placeholder for model selector - Phase 4 */}
  <div className="text-xs text-muted-foreground">
    Model selection will be added in Phase 4
  </div>
</div>
```

### 4. MotionPromptTab Component

**Purpose:** Display and edit motion/camera movement prompt (model selection comes in Phase 4)

**Props:**

```typescript
type MotionPromptTabProps = {
  frame: Frame;
  onUpdate: (updates: Partial<Frame>) => void;
};
```

**Features:**

- Label: "Motion Prompt"
- Textarea with motion prompt
- Placeholder: "Describe camera movement and motion…"
- Placeholder for model selector grid (will be added in Phase 4)

**Layout:**
Same structure as ImagePromptTab, but for motion prompt.

### 5. SceneDetailsTabs Component

**Purpose:** Container for all three tabs

**Props:**

```typescript
type SceneDetailsTabsProps = {
  frame: Frame | null;
  onUpdate: (updates: Partial<Frame>) => void;
  className?: string;
};
```

**Features:**

- Three tabs: Script, Image Prompt, Motion Prompt
- Scene heading above tabs (desktop only)
- Loading state if frame is null
- Active tab persists during session (local state)

**Layout:**

```tsx
<div className="flex flex-col gap-4">
  {/* Scene heading - desktop only */}
  <h2 className="hidden md:block text-lg font-medium">
    {frame ? getSceneTitle(frame) : <Skeleton className="h-6 w-64" />}
  </h2>

  <Tabs defaultValue="script" className="w-full">
    <TabsList className="grid w-full grid-cols-3 h-10">
      <TabsTrigger value="script" className="text-xs md:text-sm">
        Script
      </TabsTrigger>
      <TabsTrigger value="image" className="text-xs md:text-sm">
        Image Prompt
      </TabsTrigger>
      <TabsTrigger value="motion" className="text-xs md:text-sm">
        Motion Prompt
      </TabsTrigger>
    </TabsList>

    <TabsContent value="script" className="mt-4">
      {frame ? (
        <ScriptTab frame={frame} onUpdate={onUpdate} />
      ) : (
        <Skeleton className="h-24 w-full" />
      )}
    </TabsContent>

    <TabsContent value="image" className="mt-4">
      {frame ? (
        <ImagePromptTab frame={frame} onUpdate={onUpdate} />
      ) : (
        <Skeleton className="h-24 w-full" />
      )}
    </TabsContent>

    <TabsContent value="motion" className="mt-4">
      {frame ? (
        <MotionPromptTab frame={frame} onUpdate={onUpdate} />
      ) : (
        <Skeleton className="h-24 w-full" />
      )}
    </TabsContent>
  </Tabs>
</div>
```

## Implementation Guidelines

### Optimistic Updates

Use TanStack Query's optimistic updates:

```typescript
const { mutate: updateFrame } = useUpdateFrame();

const handleUpdate = (updates: Partial<Frame>) => {
  updateFrame(
    {
      frameId: frame.id,
      updates,
    },
    {
      // Optimistic update
      onMutate: async (newFrame) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries(['frame', frame.id]);

        // Snapshot previous value
        const previousFrame = queryClient.getQueryData(['frame', frame.id]);

        // Optimistically update
        queryClient.setQueryData(['frame', frame.id], (old: Frame) => ({
          ...old,
          ...updates,
        }));

        return { previousFrame };
      },
      // On error, roll back
      onError: (err, newFrame, context) => {
        queryClient.setQueryData(['frame', frame.id], context?.previousFrame);
      },
    }
  );
};
```

### Debounced Updates

For better UX, debounce text input updates:

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedUpdate = useDebouncedCallback((updates: Partial<Frame>) => {
  onUpdate(updates);
}, 500);

const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  setLocalValue(e.target.value);
  debouncedUpdate({ metadata: updateSceneScript(frame, e.target.value) });
};
```

**Note:** Can also save on blur instead of debounce for simpler implementation.

### Responsive Design

Tabs adapt on mobile:

- Text size: `text-xs md:text-sm`
- Scene heading hidden on mobile: `hidden md:block`
- Tab height: smaller on mobile

## Acceptance Criteria

- [ ] Three tabs are visible and switch correctly
- [ ] Script tab displays and updates scene description
- [ ] Image prompt tab displays and updates image prompt
- [ ] Motion prompt tab displays and updates motion prompt
- [ ] Scene heading displays above tabs on desktop
- [ ] Scene heading is hidden on mobile
- [ ] Textareas are editable with proper placeholders
- [ ] Updates are saved via API (optimistic or on blur)
- [ ] Loading skeletons show when frame is null
- [ ] Tab text size adapts on mobile
- [ ] All Storybook stories render without errors

## Storybook Stories

### SceneDetailsTabs Stories

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { SceneDetailsTabs } from './scene-details-tabs';

const meta: Meta<typeof SceneDetailsTabs> = {
  title: 'Scenes/SceneDetailsTabs',
  component: SceneDetailsTabs,
};

export default meta;
type Story = StoryObj<typeof SceneDetailsTabs>;

const mockFrame: Frame = {
  id: '1',
  sequenceId: 'seq-1',
  metadata: {
    metadata: { title: 'INT. BREWERY - DAY' },
    originalScript: {
      extract: 'A man stands in an ancient Egyptian-themed brewery.',
    },
    prompts: {
      visual: {
        fullPrompt: 'Wide shot of ancient brewery, golden lighting...',
      },
      motion: {
        fullPrompt: 'Slow dolly forward through the brewery...',
      },
    },
  } as Scene,
  thumbnailUrl: 'https://picsum.photos/1280/720',
  videoUrl: null,
};

export const Default: Story = {
  args: {
    frame: mockFrame,
    onUpdate: () => {},
  },
};

export const Loading: Story = {
  args: {
    frame: null,
    onUpdate: () => {},
  },
};

export const EmptyPrompts: Story = {
  args: {
    frame: {
      ...mockFrame,
      metadata: {
        metadata: { title: 'NEW SCENE' },
        originalScript: { extract: '' },
        prompts: {
          visual: { fullPrompt: '' },
          motion: { fullPrompt: '' },
        },
      } as Scene,
    },
    onUpdate: () => {},
  },
};
```

## Testing

### Manual Testing

1. Open Storybook and verify all stories
2. Switch between tabs
3. Edit script and verify it saves
4. Edit image prompt and verify it saves
5. Edit motion prompt and verify it saves
6. Check scene heading appears on desktop
7. Check scene heading hidden on mobile
8. Test with empty frame (loading state)

### Unit Tests

Test helper functions:

```typescript
import { describe, expect, test } from 'bun:test';
import {
  getSceneTitle,
  getSceneScript,
  getImagePrompt,
  getMotionPrompt,
  updateSceneScript,
} from './scene-content';

describe('scene-content helpers', () => {
  const mockFrame: Frame = {
    id: '1',
    metadata: {
      metadata: { title: 'Test Scene' },
      originalScript: { extract: 'Test script' },
      prompts: {
        visual: { fullPrompt: 'Test image prompt' },
        motion: { fullPrompt: 'Test motion prompt' },
      },
    } as Scene,
  };

  test('extracts scene title', () => {
    expect(getSceneTitle(mockFrame)).toBe('Test Scene');
  });

  test('extracts scene script', () => {
    expect(getSceneScript(mockFrame)).toBe('Test script');
  });

  test('extracts image prompt', () => {
    expect(getImagePrompt(mockFrame)).toBe('Test image prompt');
  });

  test('extracts motion prompt', () => {
    expect(getMotionPrompt(mockFrame)).toBe('Test motion prompt');
  });

  test('updates scene script', () => {
    const updated = updateSceneScript(mockFrame, 'New script');
    expect(updated.originalScript.extract).toBe('New script');
  });
});
```

## Commit Message

```
feat: add scene details tabs for editing

- Create SceneDetailsTabs with three tabs
- Add ScriptTab for editing scene description
- Add ImagePromptTab for image generation prompt
- Add MotionPromptTab for motion/camera prompt
- Create scene-content helper utilities
- Implement optimistic updates for frame metadata
- Add unit tests for helper functions
- Include Storybook stories for all states
```

## Next Phase

After committing this phase, proceed to **Phase 4: Model Selection Grid**.

## Notes

- Model selector grids will be added in Phase 4
- Save on blur is simpler than debounce (choose based on UX preference)
- Optimistic updates provide instant feedback
- Scene metadata structure is deeply nested - helper functions keep components clean
- Tab state persists during session (could add to URL params later)
