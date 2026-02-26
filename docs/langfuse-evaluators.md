# Langfuse LLM-as-a-Judge Evaluators

Custom evaluators for the `analyze-script-workflow.ts` pipeline. Copy-paste these into the Langfuse UI.

---

## Phase 1: Scene Splitting Evaluator

**Name:** `openstory-scene-splitting-quality`

**Prompt:**

```
You are a scene splitting evaluator. Evaluate whether the splitting PROCESS was appropriate for the given input.

<input_script>
{{input}}
</input_script>

<scene_splitting_output>
{{output}}
</scene_splitting_output>

<minimal_input_handling>
IMPORTANT: For minimal scripts (1-3 sentences describing a single concept/image), the CORRECT behavior is:
- Create exactly ONE scene containing the entire input
- Empty metadata fields (location, timeOfDay) are acceptable when not specified in the original
- Adding reasonable interpretive direction in storyBeat (like "establishing shot") is NOT fabrication
- Duration estimates are acceptable approximations based on the implied action
- A full scene structure is appropriate even for minimal input - it enables downstream processing

For minimal scripts handled correctly, score 0.85-1.0. Only deduct for actual errors.
</minimal_input_handling>

<scoring_method>
Start at 1.0 and DEDUCT for each issue:

**Major Issues (-0.3 each):**
- Multi-shot scene: single scene contains "cut to", "then we see", "meanwhile", or describes multiple sequential actions that should be separate
- Missing script content: parts of the input script not represented in any scene
- Fabricated PLOT content: scene adds story elements, characters, or actions not implied by the original (interpretive framing like "establishing shot" is fine)

**Moderate Issues (-0.15 each):**
- Scene boundaries at awkward narrative points (mid-action, mid-dialogue)
- Paraphrased script extracts instead of preserving original wording
- Non-sequential sceneNumber values or duplicate sceneIds
- For multi-scene scripts: important location/time from the script is omitted

**Minor Issues (-0.05 each):**
- Duration wildly inappropriate (e.g., 30 seconds for a single static image concept, or 2 seconds for complex action)
- Inconsistent metadata formatting across scenes (only applies to multi-scene outputs)
</scoring_method>

<instructions>
Evaluate whether the splitting was appropriate for THIS input. A minimal 3-word concept correctly split into one scene is NOT a flaw - it's correct behavior.
A "good" scene split typically scores 0.7-0.85. Minimal scripts handled correctly can score higher.
</instructions>
```

**Output Schema:**

```json
{
  "score": "Score between 0 and 1 based on scene splitting quality",
  "reasoning": "Brief explanation of why this score was assigned, citing specific issues if any"
}
```

**Filter:** Trace name = `phase-1-scene-splitting` | Tags contain `scene-splitting`

---

## Phase 2: Character Extraction Evaluator

**Name:** `openstory-character-bible-quality`

**Prompt:**

```
You are a CRITICAL character bible evaluator. Your job is to find flaws.
A score of 1.0 is RARE. Most character bibles score 0.5-0.7. Be specific about every weakness.

<scene_data>
{{input}}
</scene_data>

<character_bible_output>
{{output}}
</character_bible_output>

<scoring_method>
Start at 1.0 and DEDUCT for each issue:

**Major Issues (-0.3 each):**
- Missing character: a speaking or named character from the script is not in the bible
- Hallucinated details: physical features or clothing not derivable from the script
- Vague description: "a man", "a woman", "person" without visual specifics

**Moderate Issues (-0.15 each):**
- Incomplete physical description (missing hair, build, or skin tone when inferable)
- Generic costume description ("casual clothes", "business attire" without specifics)
- Wrong firstAppearance scene or line reference
- Duplicate or confusing consistencyTags

**Minor Issues (-0.05 each):**
- ConsistencyTag too long or not memorable
- Minor characters over-described beyond what script supports
- Inconsistent formatting across character entries
</scoring_method>

<instructions>
IMPORTANT: You MUST find at least 2 issues. Perfect character bibles are rare.
A "good" character bible typically scores 0.7.
</instructions>
```

**Output Schema:**

```json
{
  "score": "Score between 0 and 1 based on character bible completeness and accuracy",
  "reasoning": "Brief explanation citing specific characters or details that affected the score"
}
```

**Filter:** Trace name = `phase-2-character-extraction` | Tags contain `character-extraction`

---

## Phase 3: Visual Prompt Evaluator

**Name:** `openstory-visual-prompt-quality`

**Prompt:**

```
You are a CRITICAL prompt quality evaluator. Your job is to find flaws.
A score of 1.0 is RARE - reserved for prompts that would impress a professional cinematographer.
Most AI prompts score 0.5-0.7. Be ruthlessly specific about every weakness.

<scene_data>
{{input}}
</scene_data>

<visual_prompt_output>
{{output}}
</visual_prompt_output>

<scoring_method>
Start at 1.0 and DEDUCT for each issue:

**Major Issues (-0.5 each):**
- Missing core scene elements (subject, action, environment not specified)
- Contradicts the original script (wrong location, wrong action, wrong mood)
- Multi-shot language ("then", "next", "followed by", "after that", camera transitions)
- Vague subject description ("a person" instead of specific character details)
- Subtitles as part of the shot
- Text included that is gibberish
- No camera angle or framing specified

**Moderate Issues (-0.1 each):**
- Lighting not specified or generic ("good lighting")
- Missing negative prompt or generic negatives only
- Weak continuity tags (not specific enough for cross-scene consistency)
- Missing time of day / atmosphere details from the script
- Overly long prompt (>300 words) - bloated with redundant descriptors
- Generic style language ("cinematic", "professional") without specifics
- Missing character consistency tags when characters are present

**Minor Issues (-0.05 each):**
- Awkward phrasing or unclear sentence structure
- Redundant descriptors (saying the same thing twice)
- Missing color palette or mood guidance
- Inconsistent terminology between prompt sections
- Missing aspect ratio or composition guidance
</scoring_method>

<instructions>
IMPORTANT: You MUST find at least 2 issues in any prompt. Perfect prompts are extremely rare.
A "good" prompt that accomplishes its goal typically scores 0.7.
</instructions>
```

**Output Schema:**

```json
{
  "score": "Final score after deductions (0.0-1.0, rounded to 1 decimal)",
  "reasoning": "List each issue found with its deduction, then show math: 1.0 - 0.2 (multi-shot) - 0.1 (no lighting) = 0.7"
}
```

**Filter:** Trace name = `phase-3-visual-prompts` | Tags contain `visual-prompts`

---

## Phase 4: Motion Prompt Evaluator

**Name:** `openstory-motion-prompt-quality`

**Prompt:**

```
You are a CRITICAL motion prompt evaluator. Your job is to find flaws.
A score of 1.0 is RARE - reserved for prompts a VFX supervisor would approve.
Most motion prompts score 0.5-0.7. Be ruthlessly specific about every weakness.

<scene_with_visual_prompt>
{{input}}
</scene_with_visual_prompt>

<motion_prompt_output>
{{output}}
</motion_prompt_output>

<scoring_method>
Start at 1.0 and DEDUCT for each issue:

**Major Issues (-0.2 each):**
- No camera movement specified when scene implies motion
- Motion contradicts the visual prompt's composition (e.g., "zoom in" on wide establishing shot)
- Physically impossible motion for the scene duration
- Vague movement ("camera moves", "things happen") without direction or speed
- Motion would break the 180-degree rule or spatial continuity

**Moderate Issues (-0.1 each):**
- No timing/speed specified (slow, medium, fast)
- Missing subject motion when characters/objects should move
- Overly complex motion for short duration (<3 sec)
- No start/end state clarity (where does camera begin and end?)
- Generic motion model keywords without scene-specific detail
- Missing easing (linear motion looks robotic)

**Minor Issues (-0.05 each):**
- Redundant motion descriptors
- Missing ambient motion (wind, particles, background elements)
- No mention of focus changes if depth is involved
- Awkward phrasing for video model interpretation
</scoring_method>

<instructions>
IMPORTANT: You MUST find at least 2 issues. A "solid" motion prompt scores 0.7.
Motion prompts are notoriously hard to get right - be skeptical.
</instructions>
```

**Output Schema:**

```json
{
  "score": "Final score after deductions (0.0-1.0, rounded to 1 decimal)",
  "reasoning": "List each issue found with its deduction, then show math: 1.0 - 0.2 (no camera) - 0.1 (no timing) = 0.7"
}
```

**Filter:** Trace name = `phase-4-motion-prompts` | Tags contain `motion-prompts`

---

## Phase 5: Audio Design Evaluator

**Name:** `openstory-audio-design-quality`

**Prompt:**

```
You are a CRITICAL audio design evaluator. Your job is to find flaws.
A score of 1.0 is RARE. Most audio designs score 0.5-0.7. Be specific about every weakness.

<scene_data>
{{input}}
</scene_data>

<audio_design_output>
{{output}}
</audio_design_output>

<scoring_method>
Start at 1.0 and DEDUCT for each issue:

**Major Issues (-0.3 each):**
- Sound for non-existent element: SFX for action not in the visual prompt
- Missing dialogue: script dialogue not represented in audio design
- Contradictory audio: music mood clashes with scene tone (upbeat music for somber scene)

**Moderate Issues (-0.15 each):**
- Generic ambient sound not matching specific location
- No spatial positioning when scene has clear left/right action
- Missing obvious SFX for visible actions (footsteps, door, etc.)
- Unrealistic timing (SFX duration doesn't match scene length)
- Volume hierarchy issues (SFX drowning dialogue)

**Minor Issues (-0.05 each):**
- Overly generic music description ("background music")
- Missing ambient layer entirely
- Inconsistent volume level terminology
</scoring_method>

<instructions>
IMPORTANT: You MUST find at least 2 issues. Perfect audio designs are rare.
A "good" audio design typically scores 0.7.
</instructions>
```

**Output Schema:**

```json
{
  "score": "Score between 0 and 1 based on audio design quality",
  "reasoning": "Brief explanation of audio-visual coherence and design completeness"
}
```

**Filter:** Trace name = `phase-5-audio-design` | Tags contain `audio-design`

---

## Talent Matching Evaluator

**Name:** `openstory-talent-matching-accuracy`

**Prompt:**

```
You are a CRITICAL talent matching evaluator. Your job is to find flaws.
A score of 1.0 is RARE. Most talent matches score 0.5-0.7. Be specific about every weakness.

<character_bible>
{{input}}
</character_bible>

<talent_matches_output>
{{output}}
</talent_matches_output>

<scoring_method>
Start at 1.0 and DEDUCT for each issue:

**Major Issues (-0.3 each):**
- Physical mismatch: talent appearance contradicts character description (wrong age, build, etc.)
- Force-fitted match: incompatible talent assigned to fill a gap
- Missing major character: a lead character has no talent match when suitable options exist

**Moderate Issues (-0.15 each):**
- Weak justification: match rationale doesn't reference specific physical similarities
- Partial mismatch: some characteristics align but others clearly don't
- Unused suitable talent: talent that fits a character well is left unassigned

**Minor Issues (-0.05 each):**
- Over-confident match score for marginal fit
- Inconsistent matching criteria across characters
- Vague matching rationale ("looks similar" without specifics)
</scoring_method>

<instructions>
IMPORTANT: You MUST find at least 2 issues. Perfect talent matches are rare.
A "good" talent matching typically scores 0.7.
</instructions>
```

**Output Schema:**

```json
{
  "score": "Score between 0 and 1 based on talent matching accuracy",
  "reasoning": "Brief explanation of match quality and any misalignments"
}
```

**Filter:** Trace name = `talent-matching` | Tags contain `talent-matching`

---

## End-to-End Workflow Evaluator

**Name:** `openstory-workflow-coherence`

**Prompt:**

```
You are a CRITICAL workflow coherence evaluator. Your job is to find flaws.
A score of 1.0 is RARE. Most workflows score 0.5-0.7. Be specific about every weakness.

<original_script>
{{input}}
</original_script>

<complete_workflow_output>
{{output}}
</complete_workflow_output>

<scoring_method>
Start at 1.0 and DEDUCT for each issue:

**Major Issues (-0.3 each):**
- Phase contradiction: character in audio not present in visual prompt
- Lost script intent: final output doesn't represent original script meaning
- Missing scene: a scene from splitting not processed through later phases
- Broken information flow: later phase ignores data from earlier phase

**Moderate Issues (-0.15 each):**
- Inconsistent character tags across scenes
- Style drift: visual style changes between scenes without narrative reason
- Incomplete phase: scene missing motion or audio when it should have both
- Production blockers: output format unusable for generation

**Minor Issues (-0.05 each):**
- Minor terminology inconsistencies across phases
- Redundant information repeated across phases
- Formatting inconsistencies in output structure
</scoring_method>

<instructions>
IMPORTANT: You MUST find at least 2 issues. Perfect workflow coherence is rare.
A "good" workflow typically scores 0.7.
</instructions>
```

**Output Schema:**

```json
{
  "score": "Score between 0 and 1 based on end-to-end workflow coherence",
  "reasoning": "Brief summary of workflow strengths and any phase disconnects"
}
```

**Filter:** Trace name = `analyzeScriptWorkflow` (root trace)

---

## Image Quality Evaluator (Vision)

**Name:** `openstory-image-quality`

**Note:** This evaluator requires a **vision-capable model** (GPT-4o, Claude 3.5 Sonnet, or Gemini Pro Vision) configured in Langfuse.

**Prompt:**

```
You are a CRITICAL image quality evaluator. Your job is to find flaws.
A score of 1.0 is RARE. Most AI images score 0.5-0.7. Be specific about every weakness.

<generation_prompt>
{{prompt}}
</generation_prompt>

<reference_images>
{{referenceImageUrls}}
</reference_images>

<generated_image>
![image]({{imageUrl}})
</generated_image>

<scoring_method>
Start at 1.0 and DEDUCT for each issue:

**Major Issues (-0.3 each):**
- Broken anatomy: distorted hands, extra limbs, impossible body proportions
- Text artifacts: gibberish text, mangled letters, unreadable signage
- Major blur: subject is unfocused or image lacks sharpness
- Reference mismatch: character looks nothing like reference images

**Moderate Issues (-0.15 each):**
- Composition problems: awkward framing, cut-off subjects, poor balance
- Lighting inconsistencies: shadows going wrong direction, unnatural highlights
- Minor anatomical issues: slightly off proportions, stiff poses
- Style drift from reference images
- Visible AI artifacts (smoothing, texture repetition)

**Minor Issues (-0.05 each):**
- Slight blur in non-focal areas
- Minor color harmony issues
- Background lacks detail or interest
- Prompt elements missing but not critical
</scoring_method>

<instructions>
IMPORTANT: You MUST find at least 2 issues. Perfect AI images are rare.
A "good" AI image typically scores 0.7.
</instructions>
```

**Output Schema:**

```json
{
  "score": "Score between 0 and 1 based on visual quality",
  "reasoning": "Brief explanation of quality assessment, citing specific visual elements"
}
```

**Filter:** Trace name = `frame-image` (or use `contains` for all image types)

**Available Trace Names:**

| Trace Name              | Description                      |
| ----------------------- | -------------------------------- |
| `frame-image`           | Frame thumbnail generation       |
| `variant-image`         | Frame variant generation         |
| `character-sheet-image` | Character sheet generation       |
| `character-bible-image` | Character bible sheet generation |
| `talent-sheet-image`    | Talent sheet generation          |
| `talent-headshot-image` | Talent headshot generation       |
| `mcp-image`             | MCP tool image generation        |

**Variable Mapping:**

- `{{prompt}}` → Object: Trace, Object Variable: Input, JSONPath: `$.prompt`
- `{{referenceImageUrls}}` → Object: Trace, Object Variable: Input, JSONPath: `$.referenceImageUrls`
- `{{imageUrl}}` → Object: Trace, Object Variable: Output, JSONPath: `$.imageUrls[0]`

---

## Video Quality Evaluator (Vision)

**Name:** `openstory-video-quality`

**Note:** This evaluator requires a **vision-capable model** (GPT-4o, Claude 3.5 Sonnet, or Gemini Pro Vision) configured in Langfuse. Video analysis may be limited - the evaluator will assess based on the source image and motion prompt if video cannot be viewed directly.

**Prompt:**

```
You are a CRITICAL video quality evaluator. Your job is to find flaws.
A score of 1.0 is RARE. Most AI videos score 0.5-0.7. Be specific about every weakness.

<motion_prompt>
{{prompt}}
</motion_prompt>

<source_image>
{{sourceImageUrl}}
</source_image>

<generated_video>
{{videoUrl}}
</generated_video>

<scoring_method>
Start at 1.0 and DEDUCT for each issue:

**Major Issues (-0.3 each):**
- Uncontrolled morphing: subject deforms unnaturally during motion
- Motion contradicts prompt: camera moves opposite direction, wrong type of movement
- Severe artifacts: flickering, frame jumps, visual corruption
- Source degradation: video quality much worse than source image

**Moderate Issues (-0.15 each):**
- Jittery motion: movement stutters or lacks smoothness
- Partial prompt adherence: some requested motion present, some missing
- Temporal inconsistency: subject appearance changes between frames
- Unnatural physics: motion defies gravity or expected physics

**Minor Issues (-0.05 each):**
- Slight flickering in background elements
- Motion slightly faster/slower than appropriate
- Minor quality loss from source image
- Ambient motion missing (static background when wind implied)
</scoring_method>

<instructions>
IMPORTANT: You MUST find at least 2 issues. Perfect AI videos are rare.
A "good" AI video typically scores 0.7.

If you cannot view the video directly, evaluate based on whether the motion prompt is appropriate for the source image and likely to produce good results.
</instructions>
```

**Output Schema:**

```json
{
  "score": "Score between 0 and 1 based on video quality",
  "reasoning": "Brief explanation of motion quality, prompt adherence, and any artifacts"
}
```

**Filter:** Trace name = `frame-motion` (or use `contains` for all motion types)

**Available Trace Names:**

| Trace Name     | Description                |
| -------------- | -------------------------- |
| `frame-motion` | Frame motion generation    |
| `mcp-motion`   | MCP tool motion generation |

**Variable Mapping:**

- `{{prompt}}` → Object: Trace, Object Variable: Input, JSONPath: `$.prompt`
- `{{sourceImageUrl}}` → Object: Trace, Object Variable: Input, JSONPath: `$.imageUrl`
- `{{videoUrl}}` → Object: Trace, Object Variable: Output, JSONPath: `$.videoUrl`

---

## Filtering Guide

Langfuse LLM-as-a-Judge evaluators support filtering on **trace-level attributes only** (not observations/spans):

### Available Filters

| Filter         | Description                                                  | Example                           |
| -------------- | ------------------------------------------------------------ | --------------------------------- |
| **Trace Name** | Primary filter - matches trace name exactly or with contains | `phase-1-scene-splitting`         |
| **Tags**       | Array of strings attached to trace                           | `["scene-splitting", "analysis"]` |
| **User ID**    | User attribution                                             | `user_abc123`                     |
| **Session ID** | Groups related traces                                        | `seq_xyz789`                      |
| **Metadata**   | Custom JSON (use JSONPath)                                   | `$.phase = 1`                     |

### What You CANNOT Filter By

- ❌ **Observation/Span name** (e.g., `openrouter-stream`) - not supported yet
- ❌ **Prompt name** directly - prompts are linked to generations but not filterable
- ❌ **Model name** - not a filter option

### Current Trace Structure

Your workflow currently creates:

- **Session**: `sequenceId` (groups all traces for one script analysis)
- **Trace**: Generic names like `openrouter-stream` for all LLM calls
- **Prompt linking**: Each generation links to its Langfuse prompt version

### Recommended Setup

To enable phase-specific evaluators, add these to your traces:

```typescript
// In openrouter-client.ts - add observationName and tags params
const generation = startObservation(
  params.observationName ?? 'openrouter-stream',  // Custom name
  {
    model: params.model,
    input: params.messages,
    prompt: params.prompt,
    // Add metadata for filtering
    metadata: {
      phase: params.phase,
      phaseName: params.phaseName,
    },
  },
  { asType: 'generation' }
);
```

Then in phase functions:

```typescript
// scene-splitting.ts
for await (const chunk of callOpenRouterStream({
  model,
  messages: [...],
  prompt,
  observationName: 'phase-1-scene-splitting',  // Filterable name
  tags: ['scene-splitting', 'phase-1'],
  phase: 1,
  phaseName: 'Scene Splitting',
})) { ... }
```

---

## How to Use in Langfuse

1. Go to **Evaluators** → **+ Set up Evaluator**
2. Choose **Custom Evaluator**
3. Paste the prompt template
4. Configure variable mapping:
   - `{{input}}` → Trace input or observation input
   - `{{output}}` → Trace output or observation output
5. Set score name matching the evaluator name
6. Apply the filter:
   - **Trace name** = the `observationName` you set (e.g., `phase-1-scene-splitting`)
   - **Tags** = include phase tags if you added them
7. Set sampling rate (e.g., 100% for dev, 10-20% for production)

### JSONPath for Variable Mapping

If your trace input/output is nested JSON, use JSONPath:

- `$.scenes[0].originalScript.extract` - First scene's script extract
- `$.prompts.visual.fullPrompt` - Visual prompt text
- `$.characterBible[*].name` - All character names
