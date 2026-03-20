# Analyze Script Workflow

End-to-end pipeline that transforms a user's script into a complete storyboard with images, motion video, and music.

## High-Level Overview

```mermaid
flowchart TD
    Verify["<b>Verify + Prepare</b> · &lt;1s<br/>IN: sequenceId, userId, teamId<br/>OUT: script, aspectRatio, styleConfig,<br/>analysisModelId, imageModel, videoModel"] --> SceneSplit

    subgraph "Phase 1 — Script Analysis · ~3min"
        SceneSplit["<b>Scene Splitting</b> · LLM streaming · ~3min<br/>IN: script, aspectRatio<br/>OUT: scenes[], title, frameMapping[]<br/><i>frames created progressively as scenes stream in</i>"]
    end

    subgraph "Phase 2 — Extraction (sequential) · ~2.5min"
        CharExtract["<b>Character Extraction</b> · LLM · ~1min<br/>IN: scenes[]<br/>OUT: characterBible[]"]
        LocExtract["<b>Location Extraction</b> · LLM · ~1.5min<br/>IN: scenes[]<br/>OUT: locationBible[]"]
        CharExtract --> LocExtract
    end

    SceneSplit --> CharExtract

    subgraph "Phase 2b — Matching (sequential, conditional) · &lt;1s if skipped"
        TalentMatch["<b>Talent Matching</b> · LLM<br/>IN: characterBible[], talentList[] (from DB)<br/>OUT: talentCharacterMatches[]<br/><i>skipped if no suggestedTalentIds</i>"]
        LocMatch["<b>Location Matching</b> · LLM<br/>IN: locationBible[], libraryLocationList[] (from DB)<br/>OUT: libraryLocationMatches[]<br/><i>skipped if no suggestedLocationIds</i>"]
        TalentMatch --> LocMatch
    end

    LocExtract --> TalentMatch

    subgraph "Phase 3 — Reference Generation (parallel) · ~1min"
        CharSheets["<b>Character Sheets</b> · image gen ×N chars<br/>IN: characterBible[], talentCharacterMatches[]<br/>OUT: charactersWithSheets[]<br/>(sheetImageUrl per character)"]
        LocSheets["<b>Location Sheets</b> · image gen ×N locs<br/>IN: locationBible[], libraryLocationMatches[]<br/>OUT: locationsWithSheets[]<br/>(referenceImageUrl per location)"]
        VisualPrompts["<b>Visual Prompts</b> · LLM ×N scenes<br/>IN: scenes[], characterBible[], locationBible[],<br/>styleConfig, aspectRatio, analysisModelId<br/>OUT: scenesWithVisualPrompts[]<br/>(fullPrompt, negativePrompt, continuity per scene)"]
    end

    LocMatch --> CharSheets
    LocMatch --> LocSheets
    LocMatch --> VisualPrompts

    subgraph "Phase 4 — Image Generation · ~1.5min"
        PersistVisual["<b>Persist Visual Prompts</b> · DB<br/>IN: scenesWithVisualPrompts[], frameMapping<br/>OUT: frames updated with prompts + continuity"]
        ImageGen["<b>Image Generation</b> · Fal.ai ×N scenes parallel<br/>IN: fullPrompt, imageModel, imageSize,<br/>characterRefs[], locationRefs[] per scene<br/>OUT: imageUrls[] (thumbnailUrl per frame)"]
        PersistVisual --> ImageGen
    end

    CharSheets -->|"charactersWithSheets"| ImageGen
    LocSheets -->|"locationsWithSheets"| ImageGen
    VisualPrompts -->|"scenesWithVisualPrompts"| PersistVisual

    subgraph "Phase 5 — Motion Prompts · ~30s"
        MotionPrompts["<b>Motion Prompt Generation</b> · LLM ×N scenes parallel<br/>IN: scenes[], aspectRatio, characterBible[], styleConfig<br/>OUT: motionPrompt per scene"]
        MergeMotion["<b>Merge + Persist</b> · DB<br/>IN: scenesWithVisualPrompts[], motionPrompts[],<br/>videoModel capabilities<br/>OUT: scenesWithMotionPrompts[]<br/>(snapped durationSeconds per scene)"]
        MotionPrompts --> MergeMotion
    end

    ImageGen --> MotionPrompts
    VisualPrompts -->|"scenes"| MotionPrompts

    subgraph "Phase 6 — Music Design · ~1-2min"
        MusicDesign["<b>Music Design</b> · LLM · ~1-2min<br/>IN: sceneSummaries (sceneId, title, storyBeat,<br/>durationSeconds, location, timeOfDay, visualSummary)<br/>OUT: musicDesign per scene<br/>(presence, style, mood, atmosphere)<br/>+ unified tags, prompt"]
        MergeMusicDesign["<b>Merge + Persist</b> · DB<br/>IN: scenesWithMotionPrompts[], musicDesign[]<br/>OUT: completeScenes[]"]
        MusicDesign --> MergeMusicDesign
    end

    MergeMotion -->|"scenesWithMotionPrompts"| MusicDesign

    subgraph "Phase 7 — Motion + Music Generation"
        MotionGen["<b>Motion Generation</b> · Fal.ai ×N parallel · ~1-5min<br/>IN: imageUrls[], motionPrompts[],<br/>videoModel, aspectRatio, durationSeconds<br/>OUT: videoUrl per frame<br/><i>only if autoGenerateMotion</i>"]
        MusicGen["<b>Music Generation</b> · Fal.ai · ~30-120s<br/>IN: prompt, tags, totalDuration, musicModel<br/>OUT: musicUrl on sequence<br/><i>only if autoGenerateMusic</i>"]
    end

    MergeMusicDesign -->|"completeScenes"| MotionGen
    MergeMusicDesign -->|"tags + prompt"| MusicGen
    ImageGen -->|"imageUrls"| MotionGen
    MergeMotion -->|"motionPrompts + durations"| MotionGen

    MotionGen --> Trace
    MusicGen --> Trace
    Trace["<b>Record Trace</b> · &lt;1s<br/>IN: script, styleConfig, completeScenes[]<br/>OUT: Langfuse trace + generation.complete"]

    style Verify fill:#2d2d44,color:#fff
    style Trace fill:#1a472a,color:#fff
```

> **Timing source:** Measured from local QStash logs for a 9-scene run. Music design (~1-2 min) replaced the old audio design (~6 min) bottleneck. Motion and music generation times depend on model and scene count.

### Per-Scene Fan-Out Detail

Image generation, motion prompts, and motion generation each fan out to parallel sub-workflows per scene, then join before the next phase. Each sub-workflow is an independent QStash invocation with its own retries.

```mermaid
flowchart LR
    subgraph "Phase 4 — Image Generation · ~1.5min wall time"
        direction LR
        ImgFork["Persist visual<br/>prompts to frames"] --> Img1["<b>Scene 1</b><br/>image workflow"]
        ImgFork --> Img2["<b>Scene 2</b><br/>image workflow"]
        ImgFork --> Img3["<b>Scene 3</b><br/>image workflow"]
        ImgFork --> ImgDots["<b>···</b>"]
        ImgFork --> ImgN["<b>Scene N</b><br/>image workflow"]
        Img1 --> ImgJoin["All images<br/>complete"]
        Img2 --> ImgJoin
        Img3 --> ImgJoin
        ImgDots --> ImgJoin
        ImgN --> ImgJoin
    end

    ImgJoin --> MPFork

    subgraph "Phase 5 — Motion Prompts · ~30s wall time"
        direction LR
        MPFork["Start motion<br/>prompt workflow"] --> MP1["<b>Scene 1</b><br/>LLM call"]
        MPFork --> MP2["<b>Scene 2</b><br/>LLM call"]
        MPFork --> MP3["<b>Scene 3</b><br/>LLM call"]
        MPFork --> MPDots["<b>···</b>"]
        MPFork --> MPN["<b>Scene N</b><br/>LLM call"]
        MP1 --> MPJoin["Merge + snap<br/>durations"]
        MP2 --> MPJoin
        MP3 --> MPJoin
        MPDots --> MPJoin
        MPN --> MPJoin
    end

    MPJoin --> MusicDesign["Phase 6: Music Design"]
    MusicDesign --> MotFork

    subgraph "Phase 7 — Motion Generation · ~1-5min wall time (if enabled)"
        direction LR
        MotFork["Start motion<br/>generation"] --> Mot1["<b>Scene 1</b><br/>motion workflow"]
        MotFork --> Mot2["<b>Scene 2</b><br/>motion workflow"]
        MotFork --> Mot3["<b>Scene 3</b><br/>motion workflow"]
        MotFork --> MotDots["<b>···</b>"]
        MotFork --> MotN["<b>Scene N</b><br/>motion workflow"]
        Mot1 --> MotJoin["All videos<br/>complete"]
        Mot2 --> MotJoin
        Mot3 --> MotJoin
        MotDots --> MotJoin
        MotN --> MotJoin
    end

    MotJoin --> Done["Record trace"]
```

## Triggering Flow

The pipeline starts from server handlers in `src/functions/sequences.ts`:

1. **`createSequenceFn`** -- Creates a new sequence record, then calls `triggerWorkflow('/storyboard', input)` via QStash
2. **`updateSequenceFn`** -- If script, style, aspect ratio, or analysis model changed, triggers the same workflow
3. **`retryStoryboardFn`** -- Retries a failed sequence (resets status to `processing`, re-triggers)

All three use `triggerWorkflow()` from `src/lib/workflow/client.ts`, which:

- Resolves the webhook URL (rewrites localhost to `host.docker.internal` for local dev)
- Calls `WorkflowClient.trigger()` with the URL `{baseUrl}/api/workflows/storyboard`
- Returns a `workflowRunId` for tracking

**Input shape (`StoryboardWorkflowInput`):**

| Field                  | Type      | Purpose                                      |
| ---------------------- | --------- | -------------------------------------------- |
| `userId`               | string    | Auth context                                 |
| `teamId`               | string    | Auth context                                 |
| `sequenceId`           | string    | Target sequence                              |
| `options`              | object    | `framesPerScene`, `generateThumbnails`, etc. |
| `autoGenerateMotion`   | boolean   | Whether to generate video for each frame     |
| `autoGenerateMusic`    | boolean   | Whether to generate music for the sequence   |
| `musicModel`           | string?   | Override music model                         |
| `suggestedTalentIds`   | string[]? | Pre-selected talent for casting              |
| `suggestedLocationIds` | string[]? | Pre-selected locations for matching          |

## Storyboard Workflow

**File:** `src/lib/workflows/storyboard-workflow.ts`

The storyboard workflow is a thin wrapper that validates data and delegates to the analyze-script workflow.

```mermaid
flowchart TD
    Start["POST /api/workflows/storyboard"] --> Verify["verify-clear-and-start-processing"]
    Verify -->|"Validates auth<br/>Loads sequence + style<br/>Deletes existing frames<br/>Sets status = processing"| Invoke["context.invoke('analyze-script')"]
    Invoke -->|"retries: 3<br/>retryDelay: exponential"| ASW["analyzeScriptWorkflow"]
    ASW --> Emit["emit generation.complete"]
```

**Step: `verify-clear-and-start-processing`**

1. Validates auth via `validateSequenceAuth()`
2. Loads sequence with `getSequenceForUser()` -- checks script and style exist
3. Loads and parses the style config
4. Deletes all existing frames for the sequence
5. Sets sequence status to `processing`
6. Returns resolved models: `analysisModelId`, `imageModel`, `videoModel`

Then invokes `analyzeScriptWorkflow` with retries (3 attempts, exponential backoff).

After the analyze-script workflow completes, emits `generation.complete`.

## Analyze Script Workflow -- Phase-by-Phase

**File:** `src/lib/workflows/analyze-script-workflow.ts`

This is the core orchestration workflow. It uses `durableStreamingSceneSplit()` for Phase 1 (streaming scene parsing), `durableLLMCall()` for other LLM interactions, and `context.invoke()` for sub-workflows.

### Phase 1: Scene Splitting (Streaming LLM)

Uses `durableStreamingSceneSplit()` — a streaming variant that creates frames progressively as scenes arrive from the LLM, rather than waiting for the full response.

**Steps:**

1. **`prepare-scene-splitting`** — Fetches the prompt template, emits `generation.phase:start` (phase 1)
2. **`scene-splitting-stream`** — Streams the LLM response through `createStreamingSceneParser()`:
   - Parses incremental JSON chunks via `partial-json`
   - On each complete scene: calls `upsertFrame()` to create/update the frame in DB, emits `generation.scene:new` and `generation.frame:created`
   - On title detection: updates the sequence title, emits `generation.updated`
   - Sets sequence status to `completed` once streaming finishes (frames are visible, generation continues)
3. **`reconcile-frames`** — Bulk upserts all frames via `bulkInsertFrames()` to handle QStash replay safety (idempotent on `sequenceId + orderIndex` conflict)
4. **`deduct-llm-credits-scene-splitting`** + **`log-scene-splitting`** — Credit deduction and phase completion logging

- **Prompt:** `phase/scene-splitting-chat`
- **Variables:** `{ aspectRatio, script }` (script is sanitized)
- **Response schema:** `sceneSplittingResultSchema`
- **Output:** `{ scenes[], title, frameMapping[] }` — `frameMapping` is an array of `{ sceneId, frameId }` used throughout remaining phases

### Phase 2: Character + Location Extraction (LLM)

Two sequential LLM calls:

**Character extraction:**

- **Step:** `durableLLMCall('character-extraction')`
- **Prompt:** `phase/character-extraction-chat`
- **Variables:** `{ scenes }` (JSON-serialized)
- **Output:** `{ characterBible }` -- array of characters with physical descriptions, clothing, consistency tags

**Location extraction:**

- **Step:** `durableLLMCall('location-extraction')`
- **Prompt:** `phase/location-extraction-chat`
- **Variables:** `{ scenes }` (JSON-serialized)
- **Output:** `{ locationBible }` -- array of locations with descriptions, architecture, color palettes

### Phase 2b: Talent + Location Matching (Conditional LLM)

Only runs if `suggestedTalentIds` or `suggestedLocationIds` were provided.

**Talent matching:**

1. **Step:** `get-talent-list` -- Loads talent records from DB by IDs
2. **Step:** `durableLLMCall('talent-matching')` -- LLM matches characters to talent
3. **Step:** `build-matches` -- Deduplicates matches (each talent/character used once), emits `generation.talent:matched`

**Location matching:**

1. **Step:** `get-library-locations` -- Loads library locations from DB by IDs
2. **Step:** `durableLLMCall('location-matching')` -- LLM matches locations to library entries (requires confidence >= 0.5)
3. **Step:** `build-location-matches` -- Deduplicates matches, emits `generation.location:matched`

### Phase 3: Character Sheets + Location Sheets + Visual Prompts (Parallel Sub-Workflows)

Three sub-workflows invoked in parallel via `Promise.all([context.invoke(...)])`:

```mermaid
flowchart LR
    P3["Phase 3 Start"] --> CS["characterBibleWorkflow<br/>Generate character sheets"]
    P3 --> LS["locationBibleWorkflow<br/>Generate location sheets"]
    P3 --> VP["visualPromptWorkflow<br/>Generate visual prompts"]
    CS --> Join["All 3 complete"]
    LS --> Join
    VP --> Join
```

**Character Bible Workflow** (`src/lib/workflows/character-bible-workflow.ts`):

- Generates a reference sheet image for each character (parallel per character)
- Uses talent match images as reference when available
- Uploads sheets to R2 storage
- Creates `sequence_characters` DB records
- Emits `generation.phase:start` (phase 3) and `generation.phase:complete`

**Location Bible Workflow** (`src/lib/workflows/location-bible-workflow.ts`):

- Inserts location records into DB from location bible
- Generates establishing-shot reference images for each location (parallel)
- Uses library location reference images when matched
- Uploads to R2 storage, updates DB
- Emits `generation.phase:start` (phase 4) and `generation.phase:complete`

**Visual Prompt Workflow** (`src/lib/workflows/visual-prompt-workflow.ts`):

- Delegates to `visualPromptSceneWorkflow` per scene (parallel via `context.invoke`)
- Each scene gets an LLM call that generates a `fullPrompt`, `negativePrompt`, and `continuity` data (character tags, environment tag, color palette, lighting)
- Merges results back into scene objects

### Phase 4: Persist Visual Prompts + Image Generation

**Step:** `update-frames-after-visual-prompts`

- Writes visual prompts and continuity data to frame records in DB
- Emits `generation.frame:updated` with `updateType: 'visual-prompt'` for each frame

**Image generation** (parallel per scene):

- Records analysis duration on the sequence
- Emits `generation.phase:start` (phase 5, "Generating images...")
- Builds per-scene character and location reference maps (for consistency)
- Invokes `generateImageWorkflow` per scene in parallel:
  - Each gets the visual prompt, image model, image size, and reference images
  - Retries: 3 attempts with exponential backoff
  - Flow control via `getFalFlowControl()`
- Emits `generation.phase:complete` (phase 5)

**Image Workflow** (`src/lib/workflows/image-workflow.ts`):

1. Sets frame `thumbnailStatus` to `'generating'`, emits `generation.image:progress`
2. Calls `generateImageWithProvider()` (Fal.ai)
3. Deducts credits
4. Uploads image to R2 storage
5. Updates frame with `thumbnailUrl`, sets `thumbnailStatus` to `'completed'`
6. Emits `generation.image:progress` with `status: 'completed'`

### Phase 5: Motion Prompt Generation

**Sub-workflow:** `motionPromptWorkflow` (`src/lib/workflows/motion-prompt-workflow.ts`)

- Delegates to `motionPromptSceneWorkflow` per scene (parallel via `context.invoke`)
- Each scene gets an LLM call generating camera movement, motion style, and timing

**Step:** `merge-motion-prompts`

- Merges motion prompts into scene objects
- Snaps duration to video model capabilities

**Step:** `update-frames-after-motion-prompts`

- Writes motion prompts and snapped durations to frame records
- Emits `generation.frame:updated` with `updateType: 'motion-prompt'`

### Phase 6: Music Design (LLM)

A single LLM call that replaces the old two-call pattern (audio design + music prompt). Classifies per-scene music requirements and generates a unified music prompt with tags.

**Step:** `durableLLMCall('music-design')`

- **Prompt:** `phase/music-design-chat`
- **Input:** `sceneSummaries` — a subset of scene data per scene: `{ sceneId, title, storyBeat, durationSeconds, location, timeOfDay, visualSummary }`
- **Response schema:** `musicDesignResultSchema`
- **Output:** `{ scenes: [{ sceneId, musicDesign }], tags, prompt }`
  - `musicDesign` per scene: `{ presence, style, mood, atmosphere }`
  - `presence`: `'none'` | `'minimal'` | `'moderate'` | `'full'`
  - `tags`: comma-separated, always starts with `"instrumental"`
  - `prompt`: 1-2 sentence music generation prompt

**Step:** `merge-music-design`

- Merges `musicDesign` into scene objects to produce `completeScenes[]`

**Step:** `update-frames-after-music-design`

- Writes complete scene data (with `musicDesign`) to frame records
- Emits `generation.frame:updated` with `updateType: 'music-design'`

### Phase 7: Motion + Music Generation

Music prompt and tags come from the music design step (Phase 6) — no separate LLM call needed.

**Store music prompt:**

- **Step:** `store-music-prompt`
- Tags are reinforced with `reinforceInstrumentalTags()` (ensures `"instrumental"` prefix)
- Music prompt and tags stored on the sequence record

**Motion generation** (conditional — if `autoGenerateMotion` && `videoModel` && images exist):

- Emits `generation.phase:start` (phase 8, "Generating motion…")
- Invokes `generateMotionWorkflow` per scene in parallel
- Each motion workflow submits a job, polls for completion (batched polling, 30s tight loops with checkpoints between batches, up to 15 min timeout — ~10x fewer QStash steps than per-poll steps)
- Uploads video to R2, updates frame, emits `generation.video:progress`
- After all frames complete, auto-triggers `merge-video` workflow

**Music generation** (conditional — if `autoGenerateMusic`):

- Invokes `generateMusicWorkflow` with the generated prompt, tags, and total duration
- Music workflow generates audio via Fal.ai, uploads to R2, updates sequence record
- After completion, checks if merged video is also ready and triggers `merge-audio-video` if so

### Final: Record Trace + Return

**Step:** `record-workflow-trace`

- Records a trace to Langfuse for observability (input script, style config, aspect ratio, complete scenes, timing)

Returns the `completeScenes` array.

## Data Flow: Scene Object Accumulation

```mermaid
flowchart TD
    P1["Phase 1: Scene Splitting"] -->|"sceneId, sceneNumber,<br/>originalScript, metadata,<br/>variants, selectedVariant"| P2
    P2["Phase 2: Character +<br/>Location Extraction"] -->|"characterBible,<br/>locationBible<br/>(separate arrays)"| P3
    P3["Phase 3: Visual Prompts"] -->|"+ prompts.visual<br/>(fullPrompt, negativePrompt,<br/>components, parameters)<br/>+ continuity<br/>(characterTags, environmentTag,<br/>colorPalette, lightingSetup)"| P4
    P4["Phase 4: Images"] -->|"Frames get thumbnailUrl<br/>(Scene object unchanged)"| P5
    P5["Phase 5: Motion Prompts"] -->|"+ prompts.motion<br/>(fullPrompt, components,<br/>parameters)<br/>+ snapped duration"| P6
    P6["Phase 6: Music Design"] -->|"+ musicDesign<br/>(presence, style,<br/>mood, atmosphere)"| P7
    P7["Phase 7: Motion + Music"] -->|"Sequence gets musicUrl,<br/>Frames get videoUrl"| Final["Complete Scene"]

    style Final fill:#1a472a,color:#fff
```

Each phase enriches the `Scene` object. The frame's `metadata` column is updated after phases 3, 5, and 6 to persist intermediate results. Phase 1 now creates frames progressively during streaming rather than in a single batch.

## Real-Time Events

Events emitted via Upstash Realtime on a per-sequence channel (`getGenerationChannel(sequenceId)`).

| Event                                 | When Emitted                                     | Payload                                                               |
| ------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `generation.phase:start`              | Before each LLM call or generation phase         | `{ phase, phaseName }`                                                |
| `generation.phase:complete`           | After each phase completes                       | `{ phase }`                                                           |
| `generation.scene:new`                | Phase 1 -- progressively as scenes stream in     | `{ sceneId, sceneNumber, title, scriptExtract, durationSeconds }`     |
| `generation.updated`                  | Phase 1 -- after title detected in stream        | `{ title }`                                                           |
| `generation.frame:created`            | Phase 1 -- progressively as frames are upserted  | `{ frameId, sceneId, orderIndex }`                                    |
| `generation.frame:updated`            | Phases 4, 5, 6 -- after prompts written to DB    | `{ frameId, updateType, metadata }`                                   |
| `generation.talent:matched`           | Phase 2b -- when talent matched to characters    | `{ matches: [{ characterId, characterName, talentId, talentName }] }` |
| `generation.location:matched`         | Phase 2b -- when locations matched to library    | `{ matches: [{ locationId, locationName, libraryLocationId, ... }] }` |
| `generation.image:progress`           | Image workflow -- generating/completed/failed    | `{ frameId, status, thumbnailUrl? }`                                  |
| `generation.video:progress`           | Motion workflow -- generating/completed/failed   | `{ frameId, status, videoUrl? }`                                      |
| `generation.audio:progress`           | Music workflow -- generating/completed/failed    | `{ status, audioUrl? }`                                               |
| `generation.character-sheet:progress` | Character bible -- per character                 | `{ characterId, status, sheetImageUrl? }`                             |
| `generation.location-sheet:progress`  | Location bible -- per location                   | `{ locationId, status, referenceImageUrl? }`                          |
| `generation.failed`                   | On workflow failure                              | `{ message }`                                                         |
| `generation.complete`                 | Storyboard workflow -- after everything finishes | `{ sequenceId }`                                                      |

## Error Handling

### Failure Function

The analyze-script workflow registers a `failureFunction` that:

1. Sanitizes the error via `sanitizeFailResponse()` — extracts inner errors from QStash wrapper patterns, maps known Cloudflare error codes (e.g., `1102` → "Worker exceeded memory limit"), and truncates messages over 500 characters
2. Updates sequence status to `'failed'` with the error message
3. Emits `generation.failed` with the sanitized error

Sub-workflows (image, motion, music, character bible, location bible) each have their own failure functions that update the relevant record's status to `'failed'`.

### Retry Strategy

| Level                              | Retries           | Backoff                            |
| ---------------------------------- | ----------------- | ---------------------------------- |
| Storyboard invoking analyze-script | 3                 | Exponential (`2^retried * 1000ms`) |
| Image generation per scene         | 3                 | Exponential                        |
| Motion generation per scene        | 3                 | Exponential                        |
| Music generation                   | 3                 | Exponential                        |
| Individual `context.run()` steps   | Managed by QStash | Automatic                          |

### QStash Durability

- Each `context.run()` step is checkpointed -- if the server restarts mid-workflow, execution resumes from the last completed step
- `context.invoke()` creates a child workflow that runs independently with its own retries
- Motion polling uses batched polling (30s tight loops with checkpoints between batches) to reduce QStash step count by ~10x

## Key Files Reference

| File                                                | Purpose                                                   |
| --------------------------------------------------- | --------------------------------------------------------- |
| `src/functions/sequences.ts`                        | Server functions that trigger the pipeline                |
| `src/lib/workflow/client.ts`                        | `triggerWorkflow()` -- QStash integration                 |
| `src/routes/api/workflows/$.ts`                     | Workflow route registration (`serveMany`)                 |
| `src/lib/workflows/storyboard-workflow.ts`          | Wrapper: verify, clear, invoke analyze-script             |
| `src/lib/workflows/analyze-script-workflow.ts`      | Core 8-phase orchestration                                |
| `src/lib/workflows/llm-call-helper.ts`              | `durableLLMCall()` + `durableStreamingSceneSplit()`       |
| `src/lib/ai/streaming-scene-parser.ts`              | Incremental JSON parser for streaming scene creation      |
| `src/lib/workflow/sanitize-fail-response.ts`        | Error message extraction from QStash failures             |
| `src/lib/db/helpers/frames.ts`                      | `upsertFrame()` / `bulkInsertFrames()` idempotent helpers |
| `src/lib/workflows/visual-prompt-workflow.ts`       | Visual prompt sub-workflow (parallel per scene)           |
| `src/lib/workflows/visual-prompt-scene-workflow.ts` | Per-scene visual prompt LLM call                          |
| `src/lib/workflows/motion-prompt-workflow.ts`       | Motion prompt sub-workflow (parallel per scene)           |
| `src/lib/workflows/motion-prompt-scene-workflow.ts` | Per-scene motion prompt LLM call                          |
| `src/lib/workflows/character-bible-workflow.ts`     | Character sheet generation                                |
| `src/lib/workflows/location-bible-workflow.ts`      | Location sheet generation                                 |
| `src/lib/workflows/image-workflow.ts`               | Image generation (Fal.ai)                                 |
| `src/lib/workflows/motion-workflow.ts`              | Motion/video generation (Fal.ai)                          |
| `src/lib/workflows/music-workflow.ts`               | Music generation (Fal.ai)                                 |
| `src/lib/realtime/index.ts`                         | Real-time event schema and channel helpers                |
| `src/lib/ai/scene-analysis.schema.ts`               | `Scene` type definition                                   |
| `src/lib/workflows/music-prompt.schema.ts`          | Music prompt Zod schema + `reinforceInstrumentalTags()`   |
| `src/lib/ai/response-schemas.ts`                    | `musicDesignResultSchema` and other LLM response schemas  |
