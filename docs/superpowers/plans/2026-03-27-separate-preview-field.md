# Separate Preview Thumbnail Field - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple preview images from the main thumbnail lifecycle by adding a dedicated `previewThumbnailUrl` DB column and removing `'preview'` from the status enum.

**Architecture:** Add a nullable `preview_thumbnail_url` column to the frames table. Preview workflows write to this new field instead of `thumbnailUrl`. The `'preview'` status value is removed from `FrameGenerationStatus` — the status enum becomes `pending | generating | completed | failed`. The UI badge shows when `previewThumbnailUrl` is set and no final `thumbnailUrl` exists yet.

**Tech Stack:** Drizzle ORM (schema + migration), Bun test, TanStack Query (cache updates), Upstash Realtime (event schema)

---

### Task 1: Add `previewThumbnailUrl` column to DB schema

**Files:**

- Modify: `src/lib/db/schema/frames.ts:23-30` (status array), `src/lib/db/schema/frames.ts:56` (after thumbnailUrl)
- Modify: `src/lib/db/schema/frames.ts:135-142` (Frame/NewFrame types)

- [ ] **Step 1: Remove `'preview'` from `FRAME_GENERATION_STATUSES` and add the new column**

In `src/lib/db/schema/frames.ts`:

Change the status array:

```typescript
export const FRAME_GENERATION_STATUSES = [
  'pending',
  'generating',
  'completed',
  'failed',
] as const;
```

Add the new column after `thumbnailUrl` (line 56):

```typescript
    thumbnailUrl: text('thumbnail_url'),
    previewThumbnailUrl: text('preview_thumbnail_url'), // Fast preview CDN URL (ephemeral, not stored in R2)
    thumbnailPath: text('thumbnail_path'), // R2 storage path (not signed URL)
```

- [ ] **Step 2: Generate and apply migration**

Run:

```bash
bun db:generate
bun db:migrate
```

Expected: A new migration file in `drizzle/` that adds the `preview_thumbnail_url` column and has no destructive changes (the `'preview'` value removal from the const array doesn't affect SQLite since it's stored as plain text).

- [ ] **Step 3: Run typecheck to find all compile errors from removing `'preview'`**

Run:

```bash
bun typecheck
```

Expected: Type errors in files that reference `'preview'` as a valid status value. These will be fixed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema/frames.ts drizzle/
git commit -m "feat: add previewThumbnailUrl column and remove 'preview' from status enum #398"
```

---

### Task 2: Update image workflow preview path

**Files:**

- Modify: `src/lib/workflows/image-workflow.ts:175-203` (preview mode branch)

- [ ] **Step 1: Update the preview mode branch to write to `previewThumbnailUrl`**

In `src/lib/workflows/image-workflow.ts`, replace the `else if` block at line 175-204:

```typescript
    } else if (imageUrl && frameId && input.skipStorage) {
      // Preview mode: store fal.ai CDN URL in dedicated preview field
      await context.run('store-preview-url', async () => {
        const updatedFrame = await scopedDb.frames.update(
          frameId,
          {
            previewThumbnailUrl: imageUrl,
            thumbnailGeneratedAt: new Date(),
            thumbnailError: null,
          },
          { throwOnMissing: false }
        );

        if (!updatedFrame) {
          console.log(
            '[ImageWorkflow]',
            `Frame ${frameId} was deleted, skipping preview update`
          );
          return;
        }

        if (sequenceId) {
          await getGenerationChannel(sequenceId)?.emit(
            'generation.image:progress',
            { frameId, previewThumbnailUrl: imageUrl }
          );
        }
      });
    }
```

Key changes:

- Writes to `previewThumbnailUrl` instead of `thumbnailUrl`
- Does NOT set `thumbnailStatus` (leaves it as-is)
- Emits `previewThumbnailUrl` in the realtime event instead of `status: 'preview'`

- [ ] **Step 2: Run typecheck**

Run: `bun typecheck`
Expected: May still have errors in other files — that's OK, we'll fix them in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/workflows/image-workflow.ts
git commit -m "feat: image workflow writes preview to previewThumbnailUrl #398"
```

---

### Task 3: Update fast-preview workflow

**Files:**

- Modify: `src/lib/workflows/fast-preview-workflow.ts:53-65` (frame creation)

- [ ] **Step 1: Remove `thumbnailStatus: 'preview'` from frame creation**

In `src/lib/workflows/fast-preview-workflow.ts`, update the frame insert at line 53-65. Change:

```typescript
        const frameInserts = scenes.map(
          (scene, index) =>
            ({
              sequenceId,
              description: scene.originalScript?.extract ?? '',
              orderIndex: index,
              metadata: scene,
              durationMs: Math.round(
                (scene.metadata?.durationSeconds ?? 3) * 1000
              ),
              videoStatus: 'pending',
            }) satisfies NewFrame
        );
```

Removed `thumbnailStatus: 'preview'` — new frames default to `'pending'`. The preview image will be set later by the image workflow writing to `previewThumbnailUrl`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/workflows/fast-preview-workflow.ts
git commit -m "feat: fast-preview workflow uses default pending status #398"
```

---

### Task 4: Update realtime schema and cache updater

**Files:**

- Modify: `src/lib/realtime/index.ts:73-83` (image:progress schema)
- Modify: `src/lib/realtime/query-cache-updater.ts:79-89` (isValidFrameStatus), `src/lib/realtime/query-cache-updater.ts:125-142` (image:progress handler)

- [ ] **Step 1: Update realtime event schema**

In `src/lib/realtime/index.ts`, update the `image:progress` event schema (lines 73-83):

```typescript
    // Image generation progress
    'image:progress': z.object({
      frameId: z.string(),
      status: z.enum([
        'pending',
        'generating',
        'completed',
        'failed',
      ]).optional(),
      thumbnailUrl: z.string().optional(),
      previewThumbnailUrl: z.string().optional(),
    }),
```

Changes: removed `'preview'` from status enum, made status optional (preview events may only send `previewThumbnailUrl` without a status change), added `previewThumbnailUrl` field.

- [ ] **Step 2: Update `isValidFrameStatus` in cache updater**

In `src/lib/realtime/query-cache-updater.ts`, update `isValidFrameStatus` (lines 79-89):

```typescript
function isValidFrameStatus(
  status: unknown
): status is Frame['thumbnailStatus'] {
  return (
    status === 'pending' ||
    status === 'generating' ||
    status === 'completed' ||
    status === 'failed'
  );
}
```

Removed `status === 'preview' ||` line.

- [ ] **Step 3: Update `generation.image:progress` cache handler**

In `src/lib/realtime/query-cache-updater.ts`, update the `generation.image:progress` case (lines 125-142):

```typescript
    case 'generation.image:progress': {
      const thumbnailUrl = getOptionalString(data, 'thumbnailUrl');
      const previewThumbnailUrl = getOptionalString(data, 'previewThumbnailUrl');
      const status = data.status;
      queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
        old?.map((f) =>
          f.id === frameId
            ? {
                ...f,
                thumbnailUrl: thumbnailUrl ?? f.thumbnailUrl,
                previewThumbnailUrl: previewThumbnailUrl ?? f.previewThumbnailUrl,
                thumbnailStatus: isValidFrameStatus(status)
                  ? status
                  : f.thumbnailStatus,
              }
            : f
        )
      );
      break;
    }
```

Added `previewThumbnailUrl` merge into cached frame.

- [ ] **Step 4: Run typecheck**

Run: `bun typecheck`
Expected: Fewer type errors now.

- [ ] **Step 5: Commit**

```bash
git add src/lib/realtime/index.ts src/lib/realtime/query-cache-updater.ts
git commit -m "feat: realtime schema and cache updater support previewThumbnailUrl #398"
```

---

### Task 5: Update generation stream reducer and event mapper

**Files:**

- Modify: `src/lib/realtime/generation-stream.reducer.ts:6-11` (FrameStatus type), `src/lib/realtime/generation-stream.reducer.ts:21-29` (StreamingFrame type)
- Modify: `src/lib/realtime/use-generation-stream.ts:34-52` (FrameStatus type and asFrameStatus)

- [ ] **Step 1: Update reducer types**

In `src/lib/realtime/generation-stream.reducer.ts`, update the `FrameStatus` type (lines 6-11):

```typescript
type FrameStatus =
  | 'pending'
  | 'generating'
  | 'completed'
  | 'failed';
```

Update `StreamingFrame` to add `previewThumbnailUrl` (lines 21-29):

```typescript
type StreamingFrame = {
  frameId: string;
  sceneId: string;
  orderIndex: number;
  imageStatus: FrameStatus;
  videoStatus: FrameStatus;
  thumbnailUrl?: string;
  previewThumbnailUrl?: string;
  videoUrl?: string;
};
```

Update the `IMAGE_PROGRESS` case (lines 267-282) to also merge `previewThumbnailUrl`:

```typescript
    case 'IMAGE_PROGRESS': {
      const { frameId, status, thumbnailUrl, previewThumbnailUrl } = action.payload;
      const frame = state.frames.get(frameId);
      if (!frame) return state;

      const newFrames = new Map(state.frames);
      newFrames.set(frameId, {
        ...frame,
        imageStatus: status ?? frame.imageStatus,
        thumbnailUrl: thumbnailUrl ?? frame.thumbnailUrl,
        previewThumbnailUrl: previewThumbnailUrl ?? frame.previewThumbnailUrl,
      });
      return {
        ...state,
        frames: newFrames,
      };
    }
```

Update the `IMAGE_PROGRESS` action type in `GenerationStreamAction` (lines 93-96):

```typescript
  | {
      type: 'IMAGE_PROGRESS';
      payload: { frameId: string; status?: FrameStatus; thumbnailUrl?: string; previewThumbnailUrl?: string };
    }
```

- [ ] **Step 2: Update event mapper in use-generation-stream.ts**

In `src/lib/realtime/use-generation-stream.ts`, update the `FrameStatus` type (lines 34-39):

```typescript
type FrameStatus =
  | 'pending'
  | 'generating'
  | 'completed'
  | 'failed';
```

Update `asFrameStatus` (lines 41-52):

```typescript
function asFrameStatus(value: unknown): FrameStatus | undefined {
  if (
    value === 'pending' ||
    value === 'generating' ||
    value === 'completed' ||
    value === 'failed'
  ) {
    return value;
  }
  return undefined;
}
```

Update the `generation.image:progress` case in `mapEventToAction` (lines 112-120):

```typescript
    case 'generation.image:progress':
      return {
        type: 'IMAGE_PROGRESS',
        payload: {
          frameId: asString(data.frameId),
          status: asFrameStatus(data.status),
          thumbnailUrl: asOptionalString(data.thumbnailUrl),
          previewThumbnailUrl: asOptionalString(data.previewThumbnailUrl),
        },
      };
```

- [ ] **Step 3: Run typecheck**

Run: `bun typecheck`
Expected: Fewer errors — mainly UI components left.

- [ ] **Step 4: Commit**

```bash
git add src/lib/realtime/generation-stream.reducer.ts src/lib/realtime/use-generation-stream.ts
git commit -m "feat: generation stream supports previewThumbnailUrl #398"
```

---

### Task 6: Update UI components

**Files:**

- Modify: `src/components/scenes/scene-thumbnail.tsx` (full rewrite of props/logic)
- Modify: `src/components/scenes/scene-list-item.tsx:92-94` (pass new prop)
- Modify: `src/components/scenes/mobile-scene-drawer.tsx:122-124` (pass new prop)
- Modify: `src/components/motion/video-state-overlay.tsx:5-11` (remove 'preview' from type)

- [ ] **Step 1: Update SceneThumbnail component**

In `src/components/scenes/scene-thumbnail.tsx`, update the full component:

```typescript
import { BlobLoaderContainer } from '@/components/ui/blob-loader';
import {
  type AspectRatio,
  getAspectRatioClassName,
} from '@/lib/constants/aspect-ratios';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { Image } from '@unpic/react';
import { memo } from 'react';

type SceneThumbnailProps = {
  thumbnailUrl?: string | null;
  previewThumbnailUrl?: string | null;
  thumbnailStatus?:
    | 'pending'
    | 'generating'
    | 'completed'
    | 'failed';
  alt: string;
  aspectRatio: AspectRatio;
  className?: string;
};

const SceneThumbnailComponent: React.FC<SceneThumbnailProps> = ({
  thumbnailUrl,
  previewThumbnailUrl,
  thumbnailStatus,
  alt,
  aspectRatio,
  className,
}) => {
  // Display the final image if available, otherwise the preview
  const displayUrl = thumbnailUrl ?? previewThumbnailUrl;
  const isPreview = !thumbnailUrl && !!previewThumbnailUrl;

  // Only show loader when there's no image at all
  const showLoader =
    !displayUrl && !!thumbnailStatus && thumbnailStatus !== 'failed';

  const showSkeleton = !displayUrl || !thumbnailStatus;
  const isFailed = thumbnailStatus === 'failed' && !displayUrl;

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        getAspectRatioClassName(aspectRatio),
        className
      )}
    >
      {showSkeleton && (
        <Skeleton className="absolute h-full w-full rounded-md" />
      )}
      {showLoader && (
        <BlobLoaderContainer size="sm" className="absolute inset-0" />
      )}

      {displayUrl && (
        <Image
          src={displayUrl}
          alt={alt}
          className="h-full w-full object-cover"
          width={320}
          height={180}
        />
      )}

      {isPreview && (
        <span className="absolute top-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
          Preview
        </span>
      )}

      {isFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
            <span className="text-xs">Failed to generate</span>
          </div>
        </div>
      )}
    </div>
  );
};

const areEqual = (
  prevProps: SceneThumbnailProps,
  nextProps: SceneThumbnailProps
): boolean => {
  return (
    prevProps.thumbnailUrl === nextProps.thumbnailUrl &&
    prevProps.previewThumbnailUrl === nextProps.previewThumbnailUrl &&
    prevProps.thumbnailStatus === nextProps.thumbnailStatus &&
    prevProps.alt === nextProps.alt &&
    prevProps.aspectRatio === nextProps.aspectRatio &&
    prevProps.className === nextProps.className
  );
};

export const SceneThumbnail = memo(SceneThumbnailComponent, areEqual);
```

- [ ] **Step 2: Update SceneListItem to pass `previewThumbnailUrl`**

In `src/components/scenes/scene-list-item.tsx`, update the SceneThumbnail usage at line 92:

```tsx
          <SceneThumbnail
            thumbnailUrl={frame?.thumbnailUrl}
            previewThumbnailUrl={frame?.previewThumbnailUrl}
            thumbnailStatus={frame?.thumbnailStatus || undefined}
            alt={title ?? 'Scene thumbnail'}
            aspectRatio={aspectRatio}
```

- [ ] **Step 3: Update MobileSceneDrawer to pass `previewThumbnailUrl`**

In `src/components/scenes/mobile-scene-drawer.tsx`, update the SceneThumbnail usage at line 122:

```tsx
        <SceneThumbnail
          thumbnailUrl={selectedFrame?.thumbnailUrl}
          previewThumbnailUrl={selectedFrame?.previewThumbnailUrl}
          thumbnailStatus={selectedFrame?.thumbnailStatus || undefined}
          alt={sceneTitle}
          aspectRatio={aspectRatio}
          className="h-10 w-10 shrink-0 rounded object-cover"
        />
```

- [ ] **Step 4: Update VideoStateOverlay to remove `'preview'` from type**

In `src/components/motion/video-state-overlay.tsx`, update the type (lines 5-11):

```typescript
type FrameStatus =
  | 'pending'
  | 'generating'
  | 'completed'
  | 'failed'
  | null;
```

- [ ] **Step 5: Run typecheck**

Run: `bun typecheck`
Expected: PASS (or very few remaining errors).

- [ ] **Step 6: Commit**

```bash
git add src/components/scenes/scene-thumbnail.tsx src/components/scenes/scene-list-item.tsx src/components/scenes/mobile-scene-drawer.tsx src/components/motion/video-state-overlay.tsx
git commit -m "feat: UI components use previewThumbnailUrl for badge logic #398"
```

---

### Task 7: Update Storybook stories and remaining references

**Files:**

- Modify: `src/components/scenes/scene-thumbnail.stories.tsx` (add Preview story)
- Modify: `src/hooks/use-frames.ts:546-603` (useFramePreviewStatus hook)

- [ ] **Step 1: Update SceneThumbnail stories**

Rewrite `src/components/scenes/scene-thumbnail.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { SceneThumbnail } from './scene-thumbnail';

const meta: Meta<typeof SceneThumbnail> = {
  title: 'Scenes/SceneThumbnail',
  component: SceneThumbnail,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SceneThumbnail>;

export const Pending: Story = {
  args: {
    thumbnailStatus: 'pending',
    alt: 'Scene 1',
  },
};

export const Generating: Story = {
  args: {
    thumbnailStatus: 'generating',
    alt: 'Scene 1',
  },
};

export const Preview: Story = {
  args: {
    previewThumbnailUrl: 'https://picsum.photos/seed/preview1/320/180',
    thumbnailStatus: 'generating',
    alt: 'Scene 1 - Preview while generating',
  },
};

export const Completed: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/seed/scene1/320/180',
    thumbnailStatus: 'completed',
    alt: 'Scene 1',
  },
};

export const Failed: Story = {
  args: {
    thumbnailStatus: 'failed',
    alt: 'Scene 1',
  },
};

export const CompletedWithDifferentImage: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/seed/scene2/320/180',
    thumbnailStatus: 'completed',
    alt: 'Scene 2 - Different composition',
  },
};
```

- [ ] **Step 2: Update `useFramePreviewStatus` hook**

In `src/hooks/use-frames.ts`, update the hook at line 546-603. Change `hasPreview` to check `previewThumbnailUrl`:

```typescript
// Hook to track preview image generation status for frames
export function useFramePreviewStatus(frames: Frame[]) {
  // Get frames that might be generating previews (no image URLs but were recently created)
  const framesNeedingPreviews = useMemo(() => {
    return frames.filter((frame) => {
      if (frame.thumbnailUrl || frame.previewThumbnailUrl) return false; // Already has an image

      // Check if frame was created recently (within last 2 minutes for faster timeout)
      const createdAt = new Date(frame.createdAt).getTime();
      const now = Date.now();
      const twoMinutesAgo = now - 2 * 60 * 1000;

      return createdAt > twoMinutesAgo;
    });
  }, [frames]);

  // Auto-refresh frames list when there are frames potentially generating previews
  const { data: refreshedFrames = frames } = useFramesBySequence(
    frames.length > 0 ? frames[0].sequenceId : '',
    {
      refetchInterval: framesNeedingPreviews.length > 0 ? 2000 : false, // Faster refresh
      staleTime: 500, // Shorter stale time for preview updates
    }
  );

  // Return status map for each frame
  return useMemo(() => {
    const statusMap = new Map<
      string,
      { isGenerating: boolean; hasPreview: boolean }
    >();

    refreshedFrames.forEach((frame) => {
      const hasPreview = !!frame.previewThumbnailUrl;

      // Check if this frame should show as generating
      let isGenerating = false;
      if (!frame.thumbnailUrl && !frame.previewThumbnailUrl) {
        const createdAt = new Date(frame.createdAt).getTime();
        const updatedAt = frame.updatedAt
          ? new Date(frame.updatedAt).getTime()
          : createdAt;
        const now = Date.now();
        const twoMinutesAgo = now - 2 * 60 * 1000;

        // Only show as generating if created recently
        isGenerating = createdAt > twoMinutesAgo || updatedAt > twoMinutesAgo;
      }

      statusMap.set(frame.id, {
        isGenerating,
        hasPreview,
      });
    });

    return statusMap;
  }, [refreshedFrames]);
}
```

- [ ] **Step 3: Run typecheck and tests**

Run:

```bash
bun typecheck
bun test
```

Expected: PASS — all type errors resolved, tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/scenes/scene-thumbnail.stories.tsx src/hooks/use-frames.ts
git commit -m "feat: update stories and preview status hook for previewThumbnailUrl #398"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full typecheck**

Run: `bun typecheck`
Expected: PASS — zero errors.

- [ ] **Step 2: Run all tests**

Run: `bun test`
Expected: PASS — all tests pass. If any tests reference `thumbnailStatus: 'preview'`, update them to use `previewThumbnailUrl` instead.

- [ ] **Step 3: Build check**

Run: `bun run build`
Expected: PASS — clean build.

- [ ] **Step 4: Grep for any remaining `'preview'` status references**

Run: `grep -rn "preview" src/ --include="*.ts" --include="*.tsx" | grep -i "thumbnailStatus.*preview\|status.*=.*'preview'\|'preview'.*status"`
Expected: No matches related to thumbnail status. (Style preview, deployment preview, etc. are unrelated and expected.)
