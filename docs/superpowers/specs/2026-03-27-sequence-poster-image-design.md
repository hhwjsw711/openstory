# Sequence Poster Image from Script

## Context

When a user submits a script, the video player shows a blob loader or skeleton until frames are generated. This takes seconds to minutes depending on the pipeline. We can generate a single "poster" image from the script text immediately, filling the empty state with a relevant visual.

This builds on the existing fast-preview system (branch `398-fast-preview`) which generates frame-level preview images. The poster is a sequence-level equivalent — one image representing the whole sequence before any frames exist.

## Design

### Data Model

Add one field to the `sequences` table:

```
posterUrl: text('poster_url')
```

- Ephemeral fal.ai CDN URL (same pattern as `previewThumbnailUrl` on frames)
- No R2 upload — this is a bridge image that becomes irrelevant once frames have thumbnails
- No status field — fire-and-forget; failure falls back to existing blob loader
- CDN URLs expire naturally; no cleanup needed

**File:** `src/lib/db/schema/sequences.ts`

### Prompt Construction

New function in a new file `src/lib/prompts/poster-prompt.ts`:

```typescript
buildPosterPrompt(title: string, script: string, styleDescription?: string): string
```

- Uses sequence title as the subject/focus
- First ~500 characters of the script as scene description
- Appends style config fields (`artStyle`, `mood`, `lighting` from `StyleConfig`) for visual consistency
- Returns a prompt string within `flux_2_turbo`'s 2000-char limit

### Generation Trigger

Generate the poster as **the first step of the storyboard workflow**, before scene splitting begins.

**File:** `src/lib/workflows/storyboard-workflow.ts`

Flow:

1. Storyboard workflow starts (already has `sequenceId`, access to sequence record)
2. New step: `context.run('generate-poster', ...)` — reads sequence title + script, builds prompt
3. Calls `generateImageWithProvider()` with `PREVIEW_IMAGE_MODEL` (`flux_2_turbo`) and the poster prompt
4. On success: updates `sequences.posterUrl` in DB, emits `generation.poster:ready` realtime event
5. On failure: logs warning, continues — no error propagation (poster is optional)
6. Existing steps continue (scene splitting, etc.)

**Why storyboard workflow, not createSequenceFn:**

- Keeps the create response instant (no 2-3s image generation delay)
- Poster arrives via realtime ~3-5s after submission
- Workflow steps are durable and retried automatically

### Realtime Event

Add to `generation` schema in `src/lib/realtime/index.ts`:

```typescript
'poster:ready': z.object({
  posterUrl: z.string(),
})
```

### Cache Update

In `src/lib/realtime/query-cache-updater.ts`, handle `generation.poster:ready`:

- Update the sequence query cache with the new `posterUrl`

### Display

**File:** `src/components/motion/scene-player.tsx`

When `frames` is empty (lines 128-154):

- Accept new prop `posterUrl?: string`
- If `posterUrl` exists: show the poster image as background behind the blob loader / progress overlay
- If no `posterUrl`: existing behavior (blob loader or skeleton)

The poster provides visual context while the progress overlay communicates generation status.

**File:** `src/components/scenes/scenes-view.tsx`

- Pass `sequence.posterUrl` to `ScenePlayer` as the `posterUrl` prop
- Already has access to `sequence` via `useSequence(sequenceId)`

### Lifecycle

- Generated once during initial storyboard workflow
- Persists on the sequence record permanently
- Becomes irrelevant once frames have thumbnails — player transitions to showing frame images
- No active cleanup — CDN URLs expire naturally over time

## Files to Modify

1. `src/lib/db/schema/sequences.ts` — add `posterUrl` field
2. Migration — `bun db:generate` after schema change
3. `src/lib/prompts/poster-prompt.ts` — new file, `buildPosterPrompt()` function
4. `src/lib/workflows/storyboard-workflow.ts` — add poster generation as first step
5. `src/lib/realtime/index.ts` — add `poster:ready` event schema
6. `src/lib/realtime/query-cache-updater.ts` — handle `poster:ready` event
7. `src/components/motion/scene-player.tsx` — accept `posterUrl` prop, display in empty state
8. `src/components/scenes/scenes-view.tsx` — pass `sequence.posterUrl` to `ScenePlayer`

## Verification

1. **Schema:** Run `bun db:generate` and `bun db:migrate` — verify migration applies cleanly
2. **Unit test:** Test `buildPosterPrompt()` with various inputs (title only, title + script, title + script + style)
3. **Type check:** `bun typecheck` passes
4. **E2E flow:** Create a new sequence with a script — observe:
   - Blob loader appears immediately
   - Poster image fades in after ~3-5s (via realtime event)
   - Frame previews eventually replace the poster in the player
5. **Failure case:** If image generation fails, poster step is skipped silently and existing blob loader behavior is preserved
