# Optimized Analyze-Script Workflow

Companion to [`workflow.md`](./workflow.md). Documents four optimizations to the analyze-script pipeline that reduce the critical path from ~15 min to ~12 min for a 9-scene run.

## Data Dependency Graph

Every phase's true inputs and outputs, traced from the code (`src/lib/workflows/analyze-script-workflow.ts`):

| Phase | Step                 | Inputs (what it actually reads)                                                        | Outputs                          | Code reference                               |
| ----- | -------------------- | -------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------- |
| 1     | Scene splitting      | `script`, `aspectRatio`                                                                | `scenes[]`                       | L163-179                                     |
| 1b    | Create frames        | `scenes[]`, `sequenceId`                                                               | frame DB rows                    | L181-240                                     |
| 2     | Character extraction | `scenes[]`                                                                             | `characterBible`                 | L243-258                                     |
| 2     | Location extraction  | `scenes[]`                                                                             | `locationBible`                  | L260-275                                     |
| 2b    | Talent matching      | `characterBible`, `suggestedTalentIds`                                                 | `talentCharacterMatches`         | L278-367                                     |
| 2b    | Location matching    | `locationBible`, `suggestedLocationIds`                                                | `libraryLocationMatches`         | L370-462                                     |
| 3     | Character sheets     | `characterBible`, `talentCharacterMatches`                                             | `charactersWithSheets`           | L466-476                                     |
| 3     | Location sheets      | `locationBible`, `libraryLocationMatches`                                              | `locationsWithSheets`            | L477-486                                     |
| 3     | Visual prompts       | `scenes[]`, `characterBible`, `locationBible`, `styleConfig`, `aspectRatio`            | `scenesWithVisualPrompts`        | L488-499                                     |
| 4     | Image generation     | `scenesWithVisualPrompts`, `charactersWithSheets`, `locationsWithSheets`, `imageModel` | `imageUrls[]` + frame DB updates | L542-627                                     |
| 4     | Motion prompts       | `scenesWithVisualPrompts`, `characterBible`, `styleConfig`, `aspectRatio`              | `motionPrompts[]`                | L636-648 (Branch A, parallel with image gen) |
| 5     | Audio design         | `scenesWithVisualPrompts` (visual prompts only, no motion data)                        | `completeScenes`                 | L720-739                                     |
| 7     | Music prompt         | `completeScenes` (with audio design)                                                   | `musicPrompt`, `tags`            | L812-825                                     |
| 7     | Motion generation    | `imageUrls[]`, `motionPrompts[]`, `videoModel`                                         | `videoUrl` frame DB updates      | L838-881                                     |
| 7     | Music generation     | `musicPrompt`, `totalDuration`, `musicModel`                                           | `musicUrl` sequence DB update    | L883-903                                     |

Key insight: arrows show what each step **actually reads**, not just what runs before it.

```mermaid
flowchart TD
    Script["script, aspectRatio"]
    Scenes["scenes[]"]
    CharBible["characterBible"]
    LocBible["locationBible"]
    VisPrompts["scenesWithVisualPrompts"]
    MotPrompts["motionPrompts"]
    Sheets["character/location sheets"]
    Images["imageUrls[]"]
    AudioOut["completeScenes"]
    MusicPromptOut["musicPrompt, tags"]

    Script --> Scenes
    Scenes --> CharBible
    Scenes --> LocBible
    Scenes --> VisPrompts
    CharBible --> VisPrompts
    LocBible --> VisPrompts
    CharBible --> Sheets
    LocBible --> Sheets
    VisPrompts --> MotPrompts
    CharBible --> MotPrompts

    VisPrompts --> Images
    Sheets --> Images

    VisPrompts --> AudioOut
    AudioOut --> MusicPromptOut

    Images -->|"Branch A"| MotionGen["Motion generation"]
    MotPrompts -->|"Branch A"| MotionGen

    MusicPromptOut -->|"Branch B"| MusicGen["Music generation"]

    style MotionGen fill:#2563eb,color:#fff
    style MusicGen fill:#7c3aed,color:#fff
```

## Optimizations

### 1. Parallel Character + Location Extraction

**Current (sequential):** ~2.5 min

```
Character extraction (~1 min) → Location extraction (~1.5 min)
```

**Optimized (parallel):** ~1.5 min

```
Character extraction (~1 min) ─┐
                                ├→ both complete
Location extraction (~1.5 min) ─┘
```

**Why it works:** Both read only `scenes[]` (L243-275). Neither reads the other's output. Character extraction produces `characterBible`; location extraction produces `locationBible`. These are consumed independently downstream.

**Code change:** Wrap the two `durableLLMCall` invocations in `Promise.all`.

**Savings:** ~1 min (character extraction runs under location extraction).

**Risk:** Two concurrent LLM calls instead of one. Acceptable — Phase 3 already runs three concurrent sub-workflows, and the LLM provider handles parallel requests.

---

### 2. Parallel Talent + Location Matching

**Current (sequential):**

```
get-talent-list → talent-matching LLM → build-matches →
get-library-locations → location-matching LLM → build-location-matches
```

**Optimized (parallel):**

```
get-talent-list → talent-matching → build-matches ────────┐
                                                           ├→ both complete
get-library-locations → location-matching → build-matches ─┘
```

**Why it works:** Talent matching reads `characterBible` + `talentList` (L278-367). Location matching reads `locationBible` + `libraryLocationList` (L370-462). No cross-dependency — each chain uses a different bible and a different library list.

**Code change:** Wrap the two matching chains in `Promise.all`.

**Savings:** Minor (both are typically <1s each, often skipped entirely). The value is primarily in unblocking the pipeline faster when both are enabled.

**Risk:** Minimal. Both matching chains are independent DB lookups + LLM calls.

---

### 3. Motion Prompts Parallel with Image Gen in Branch A

**Current:** Motion prompts run after image generation (L636), blocking audio design.

```
Phase 3 (3-way parallel) → Image Gen → Motion Prompts → Audio Design
```

**Optimized:** Motion prompts run inside Branch A, parallel with image generation via `Promise.all`.

```
Phase 3 (3-way parallel) → Fork:
  Branch A: Promise.all(Image Gen ~1.5min, Motion Prompts ~30s) → merge → Motion Gen
```

**Why it works:** Motion prompts describe camera movement for a specific visual composition. The LLM template takes `{{scene}}` as full JSON — when visual prompt data is present (composition, framing, depth), the LLM generates more coherent camera movement. Both image gen and motion prompts consume `scenesWithVisualPrompts` from Phase 3. Neither reads the other's output. Motion prompts complete in ~30s, well within image gen's ~1.5 min — the 30s is entirely hidden by the longer task.

**Code changes:**

1. Move motion prompt invocation into Branch A, wrapped in `Promise.all` with image generation

**Savings:** ~30s. Motion prompts no longer add sequential time — they're absorbed into image gen's ~1.5 min runtime.

**Quality improvement:** Motion prompts still have access to visual composition data (`scenesWithVisualPrompts`), producing well-aligned camera movement descriptions.

**Risk:** One additional concurrent LLM call during image generation. Image gen uses Fal.ai (not LLM), so there's no LLM contention — motion prompts are the only LLM call running during this window.

---

### 4. Two Parallel Branches After Phase 3

**Current (fully sequential after Phase 3):**

```
Phase 3 → Image Gen → Motion Prompts → Audio Design → Music Prompt → [Motion Gen, Music Gen]
```

**Optimized (two independent branches fork directly after Phase 3):**

```
Phase 3 ──┬→ Branch A (visual):  Promise.all(Image Gen, Motion Prompts) → merge → Motion Gen
           │
           └→ Branch B (audio):  Audio Design (visual prompts only) → Music Prompt → Music Gen
```

**Why it works:**

- **Image gen** needs: `scenesWithVisualPrompts` + `charactersWithSheets` + `locationsWithSheets` (all from Phase 3). Does NOT need motion prompts or audio design.
- **Motion prompts** need: `scenesWithVisualPrompts` + `characterBible` + `styleConfig` (all from Phase 3). Does NOT need images.
- **Audio design** needs: `scenesWithVisualPrompts` (visual prompts and scene metadata). Does NOT need motion prompts, images, or character/location sheets.
- **Motion gen** needs: `imageUrls[]` + `motionPrompts[]` (L862-874). Both produced by Branch A's `Promise.all`.
- **Music gen** needs: `musicPrompt` + `tags` + `totalDuration` (L888-902). Does NOT need images or motion videos.

The two branches share no data after Phase 3.

**Code change:**

1. After Phase 3, fork directly into two `Promise.all` branches:
   - **Branch A:** `Promise.all(imageGen, motionPrompts)` → merge motion prompts into scenes → persist motion prompt metadata → (if autoGenerateMotion) Motion gen
   - **Branch B:** Audio design (using `scenesWithVisualPrompts`) → Merge audio → Music prompt → (if autoGenerateMusic) Music gen
2. `await Promise.all([branchA, branchB])` → Final metadata merge → Record trace.

**Final metadata merge:** Both branches produce data that belongs in the frame `metadata` column. To avoid race conditions on the JSON column:

- Branch A writes only scalar columns (`motionPrompt`, `durationMs` via `update-frames-after-motion-prompts`) and `thumbnailUrl`/`videoUrl`/status columns
- Branch B holds `completeScenes` (with audio design) in memory
- After both branches complete, a single `context.run('final-metadata-merge')` step writes the unified metadata (visual prompts + motion prompts + audio design) to each frame once

**Savings:** Up to ~6 min. Audio design (~6 min) runs in parallel with image gen (~1.5 min) + motion gen (~1-5 min). The critical path is whichever branch is longer — typically Branch B (audio design is the bottleneck at ~6 min). Motion prompts (~30s) are hidden inside Branch A's image gen (~1.5 min).

**Quality tradeoff:** Audio design loses access to camera movement data (pan/tilt/tracking/speed) that was previously available via `scenesWithMotionPrompts`. Core audio decisions — music style, ambient atmosphere, dialogue timing, foley selection — are driven by scene metadata and visual prompts, not camera movement. The impact is:

- **Negligible** for music, ambient, and dialogue design (these depend on scene mood, location, and action)
- **Minor** for spatial positioning of sound effects (e.g., a tracking shot might call for spatial audio panning)

**Prompt change:** The audio design prompt (L375 in `workflow-prompts.ts`) changes from "visual and motion prompts" to "visual prompts and scene metadata".

**Risk:**

- Both branches update frame data. Branch A writes `thumbnailUrl`/`videoUrl`/status columns plus scalar motion prompt fields. Branch B holds audio design in memory. The final metadata merge writes once after both complete — no write conflicts.
- Event ordering changes: UI will receive image progress events and audio design events interleaved rather than sequentially. The UI already handles events independently per frame, so this should work.
- `completeScenes` (used for the final trace) needs audio design but NOT images/videos (those are on the frame record, not the scene object). Branch B produces `completeScenes`; Branch A doesn't modify it.

---

## Optimized Pipeline

```mermaid
flowchart TD
    Verify["<b>Verify + Prepare</b> · <1s"] --> SceneSplit

    subgraph "Phase 1 — Script Analysis · ~3min"
        SceneSplit["<b>Scene Splitting</b> · LLM · ~3min"]
        CreateFrames["<b>Create Frames</b> · DB · ~1s"]
        SceneSplit --> CreateFrames
    end

    subgraph "Phase 2 — Extraction (PARALLEL) · ~1.5min"
        CharExtract["<b>Character Extraction</b> · LLM · ~1min"]
        LocExtract["<b>Location Extraction</b> · LLM · ~1.5min"]
    end

    CreateFrames --> CharExtract
    CreateFrames --> LocExtract

    subgraph "Phase 2b — Matching (PARALLEL, conditional)"
        TalentMatch["<b>Talent Matching</b> · LLM"]
        LocMatch["<b>Location Matching</b> · LLM"]
    end

    CharExtract --> TalentMatch
    LocExtract --> LocMatch

    subgraph phase3 ["Phase 3 — References + Prompts (3-way PARALLEL) · ~1min"]
        CharSheets["<b>Character Sheets</b><br/>image gen ×N chars"]
        LocSheets["<b>Location Sheets</b><br/>image gen ×N locs"]
        VisualPrompts["<b>Visual Prompts</b><br/>LLM ×N scenes"]
    end

    TalentMatch --> CharSheets
    TalentMatch --> LocSheets
    TalentMatch --> VisualPrompts
    LocMatch --> CharSheets
    LocMatch --> LocSheets
    LocMatch --> VisualPrompts

    subgraph branchA ["Branch A — Visual · ~2.5-6.5min"]
        PersistVisual["<b>Persist Visual Prompts</b> · DB"]
        ImageGen["<b>Image Generation</b><br/>Fal.ai ×N parallel · ~1.5min"]
        MotionPrompts["<b>Motion Prompts</b> ★ MOVED<br/>LLM ×N scenes · ~30s<br/><i>parallel with image gen</i>"]
        MergeMotion["<b>Merge Motion Prompts</b><br/>+ snap durations · <1s"]
        MotionGen["<b>Motion Generation</b><br/>Fal.ai ×N parallel · ~1-5min<br/><i>if autoGenerateMotion</i>"]
        PersistVisual
        ImageGen
        MotionPrompts
        MergeMotion
        ImageGen --> MotionGen
        MotionPrompts --> MergeMotion --> MotionGen
    end

    subgraph branchB ["Branch B — Audio · ~6.5min"]
        AudioDesign["<b>Audio Design</b> ★ CHANGED<br/>LLM · ~6min<br/><i>uses scenesWithVisualPrompts</i>"]
        MergeAudio["<b>Merge Audio</b> · <1s"]
        MusicPrompt["<b>Music Prompt</b><br/>LLM · ~10s"]
        MusicGen["<b>Music Generation</b><br/>Fal.ai · ~30-120s<br/><i>if autoGenerateMusic</i>"]
        AudioDesign --> MergeAudio --> MusicPrompt --> MusicGen
    end

    phase3 --> PersistVisual
    phase3 --> MotionPrompts
    phase3 --> AudioDesign

    phase3 --> ImageGen
    CharSheets -->|"sheets"| ImageGen
    LocSheets -->|"sheets"| ImageGen

    branchA --> FinalMerge
    branchB --> FinalMerge
    FinalMerge["<b>Final Metadata Merge</b> ★ NEW<br/>DB · <1s"] --> Trace
    Trace["<b>Record Trace</b> · <1s"]

    style MotionPrompts fill:#16a34a,color:#fff
    style AudioDesign fill:#16a34a,color:#fff
    style FinalMerge fill:#d97706,color:#fff
    style branchA fill:#1e3a5f11,stroke:#2563eb
    style branchB fill:#2d1b4e11,stroke:#7c3aed
    style Trace fill:#1a472a,color:#fff
    style Verify fill:#2d2d44,color:#fff
```

## Critical Path Comparison

| Phase                                   | Current                       | Optimized                                   | Saved              |
| --------------------------------------- | ----------------------------- | ------------------------------------------- | ------------------ |
| Scene splitting + frame creation        | ~3 min                        | ~3 min                                      | —                  |
| Character + location extraction         | ~2.5 min (sequential)         | ~1.5 min (parallel)                         | **~1 min**         |
| Talent + location matching              | <1s (sequential)              | <1s (parallel)                              | minor              |
| Phase 3: refs + prompts                 | ~1 min (3-way)                | ~1 min (3-way)                              | —                  |
| Motion prompts                          | ~30s (after image gen)        | ~30s (Branch A, parallel with image gen)    | **~30s saved**     |
| Image gen                               | ~1.5 min                      | ~1.5 min (Branch A)                         | —                  |
| Audio design                            | ~6 min (after motion prompts) | ~6 min (Branch B, uses visual prompts only) | —                  |
| Music prompt                            | ~10s                          | ~10s                                        | —                  |
| Final metadata merge                    | —                             | <1s (new step)                              | —                  |
| Motion gen (if enabled)                 | ~1-5 min (after music prompt) | ~1-5 min (after image gen)                  | **up to ~6.5 min** |
| Music gen (if enabled)                  | ~30-120s                      | ~30-120s                                    | —                  |
| **Critical path (no motion/music)**     | **~14.5 min**                 | **~12 min**                                 | **~2.5 min**       |
| **Critical path (with motion + music)** | **~15-19 min**                | **~13.5 min**                               | **~1.5-5.5 min**   |

The critical path shifts from the sequential chain to `max(Branch A, Branch B)`. Branch B (audio design at ~6 min) is typically the bottleneck, so Branch A (image gen ~1.5 min + motion gen ~1-5 min) runs "for free" in parallel. Motion prompts (~30s) are hidden inside Branch A's image gen (~1.5 min), saving ~30s compared to running them sequentially before the fork.

## QStash Step Count Impact

Each optimization changes the QStash step topology:

| Optimization               | Step change                                                                    | Net impact              |
| -------------------------- | ------------------------------------------------------------------------------ | ----------------------- |
| Parallel extraction        | 2 sequential → 2 parallel (via `Promise.all` inside `context.run`)             | No new steps            |
| Parallel matching          | 2 chains sequential → 2 chains parallel                                        | No new steps            |
| Motion prompts in Branch A | 1 `context.invoke` moves into Branch A `Promise.all` (parallel with image gen) | No new steps            |
| Two branches               | 1 sequential chain → 2 `Promise.all` branches                                  | No new steps, reordered |
| Final metadata merge       | New `context.run('final-metadata-merge')` after both branches                  | 1 new step              |

Total QStash step count increases by 1 (the final metadata merge step).

## Risks and Tradeoffs

### LLM Concurrency

Optimizations #1 and #3 change peak concurrent LLM calls:

- **Current peak:** 3 (during Phase 3: char sheets, loc sheets, visual prompts — though sheets are image gen, not LLM)
- **Optimized peak:** Brief overlap during Branch A/B fork — motion prompt LLM calls (Branch A) can overlap with the audio design LLM call (Branch B) for ~30s. This is a narrow window since motion prompts complete in ~30s while audio design runs for ~6 min. Character + location extraction are parallel but happen before Phase 3, not during it.

### Database Write Conflicts

Both branches produce data for the frame `metadata` JSON column, creating a potential race condition. The solution is a final-merge pattern:

- **Branch A** writes only scalar columns: `thumbnailUrl`, `videoUrl`, `thumbnailStatus`, `videoStatus` to frames, plus `motionPrompt` and `durationMs` fields via `update-frames-after-motion-prompts`. These are separate DB columns, not the `metadata` JSON.
- **Branch B** holds `completeScenes` (with audio design) in memory — does NOT write `metadata` during the branch.
- **Final metadata merge** (`context.run('final-metadata-merge')`) runs after both branches complete, writing the unified metadata (visual prompts + motion prompts + audio design) to each frame in a single write. No race condition.

### Audio Design Quality

Audio design no longer has access to motion prompt data (camera movement, pan/tilt/tracking, speed). What's retained vs lost:

- **Retained:** Scene metadata (location, time of day, story beat, mood), visual prompts (composition, lighting, color palette), dialogue, character actions, continuity data
- **Lost:** Camera movement descriptions (e.g., "slow tracking shot left", "rapid dolly zoom")

Impact by audio category:

- **Music/ambient/dialogue:** Negligible — driven by scene mood, not camera movement
- **Sound effect spatial positioning:** Minor — a tracking shot might call for spatial audio panning, but this is a subtle enhancement, not a core decision

### Event Ordering

The UI receives events from both branches interleaved. This means:

- `generation.image:progress` events arrive while audio design is running
- `generation.frame:updated` (visual-prompt) and `generation.frame:updated` (audio-design) may arrive close together

The UI already handles each event type independently, so this should be transparent.

### Failure Isolation

If Branch A fails (image gen error), Branch B can still complete audio design and music. The workflow's `failureFunction` catches the top-level error and marks the sequence as failed. This behavior is unchanged — the `Promise.all` will reject when either branch throws.

If one branch fails, partial metadata can still be written in the final merge step (e.g., audio design data without motion prompts, or vice versa). To improve resilience, branches could use `Promise.allSettled` instead, allowing partial success. This is a separate enhancement.

### Rollback

All four optimizations are independent and can be applied incrementally. If any optimization causes issues, it can be reverted without affecting the others.
