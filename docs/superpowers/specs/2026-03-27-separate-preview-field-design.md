# Separate Preview Thumbnail Field

## Context

Preview images are fast, low-quality thumbnails generated during scene splitting to give users immediate visual feedback while the full AI pipeline runs. Currently, preview images share the `thumbnailUrl` column and use a `'preview'` status in `thumbnailStatus` to distinguish them from final images.

**Problem:** When the full image workflow starts, it sets `thumbnailStatus: 'generating'`, which removes the "Preview" badge while still displaying the old preview image. The user sees a low-quality image without any indication that it's temporary.

**Solution:** Add a dedicated `previewThumbnailUrl` column to decouple preview images from the main thumbnail lifecycle. Remove `'preview'` from the status enum entirely.

## Schema Change

Add to `frames` table in `src/lib/db/schema/frames.ts`:

```
previewThumbnailUrl: text('preview_thumbnail_url')
```

Nullable text column. No default. Persists permanently (not cleared on completion).

Remove `'preview'` from `FrameGenerationStatus` type. The status enum becomes:

```
'pending' | 'generating' | 'completed' | 'failed'
```

## Status Flow

```
pending -> generating -> completed
                      -> failed
```

`previewThumbnailUrl` is set independently by the fast-preview path. It does not participate in the status lifecycle.

## Display Logic

In `src/components/scenes/scene-thumbnail.tsx`:

- **Image source**: `thumbnailUrl ?? previewThumbnailUrl` -- show final image if available, otherwise preview
- **Badge**: show "Preview" when displaying the preview URL (i.e. `!thumbnailUrl && !!previewThumbnailUrl`)
- **Loader**: show when no image URL at all and status is not `'failed'`

## Workflow Changes

### image-workflow.ts -- Preview mode (`skipStorage: true`)

Currently writes to `thumbnailUrl` and sets `thumbnailStatus: 'preview'`.

Change to:

- Write to `previewThumbnailUrl` instead of `thumbnailUrl`
- Do NOT set `thumbnailStatus` -- leave it as-is
- Emit realtime event with `previewThumbnailUrl` field instead of setting status to `'preview'`

### image-workflow.ts -- Full generation (no `skipStorage`)

No changes. Already sets `thumbnailStatus: 'generating'` then `'completed'` with R2 URL in `thumbnailUrl`.

### scene-split-workflow.ts

Preview image invocations already use `skipStorage: true`, so they route through the updated preview path automatically.

### fast-preview-workflow.ts

Same as scene-split -- uses `skipStorage: true` to invoke the image workflow.

## Realtime Updates

### Schema (`src/lib/realtime/index.ts`)

`image:progress` event:

- Add optional `previewThumbnailUrl: z.string().optional()`
- Remove `'preview'` from the status enum

### Cache updater (`src/lib/realtime/query-cache-updater.ts`)

In the `generation.image:progress` case:

- Read `previewThumbnailUrl` from the event data
- Merge into cached frame: `previewThumbnailUrl: previewThumbnailUrl ?? f.previewThumbnailUrl`

### Status validator

Remove `'preview'` from `isValidFrameStatus()`.

## Other Changes

### use-frames.ts

The `useFramePreviewStatus` hook currently tracks preview generation by checking status. Update to check for `previewThumbnailUrl` presence directly.

### generation-stream.reducer.ts

Remove `'preview'` from the `imageStatus` type in frame streaming state. The `PREVIEW_REPLACED` action stays as-is (it handles frame list replacement when AI analysis changes scene count, unrelated to the badge).

### Storybook / test fixtures

Update any mock data or story files that use `thumbnailStatus: 'preview'` to instead set `previewThumbnailUrl`.

## Files to Modify

1. `src/lib/db/schema/frames.ts` -- add column, update type
2. `src/lib/workflows/image-workflow.ts` -- preview path writes to new field
3. `src/lib/workflows/scene-split-workflow.ts` -- verify no direct status references
4. `src/lib/workflows/fast-preview-workflow.ts` -- verify uses skipStorage path
5. `src/components/scenes/scene-thumbnail.tsx` -- new display/badge logic
6. `src/lib/realtime/index.ts` -- schema update
7. `src/lib/realtime/query-cache-updater.ts` -- handle new field
8. `src/lib/realtime/generation-stream.reducer.ts` -- remove 'preview' from types
9. `src/hooks/use-frames.ts` -- update preview status hook
10. Migration generated via `bun db:generate`

## Verification

1. Run `bun db:generate` to create migration, `bun db:migrate` to apply
2. Run `bun typecheck` -- confirm no type errors from removing 'preview' status
3. Run `bun test` -- confirm existing tests pass (update mocks as needed)
4. Manual test: create a sequence, verify preview badge appears during scene split and persists through full image generation until the final image arrives
