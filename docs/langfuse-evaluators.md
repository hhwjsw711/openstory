# Langfuse LLM-as-a-Judge Evaluators

Custom evaluators for the `analyze-script-workflow.ts` pipeline. Copy-paste these into the Langfuse UI.

---

## Phase 1: Scene Splitting Evaluator

**Name:** `velro-scene-splitting-quality`

**Prompt:**

```
You are evaluating the quality of a scene splitting analysis from a video script.

## Input Script:
{{input}}

## Scene Splitting Output:
{{output}}

## Evaluation Criteria:

1. **Scene Boundary Accuracy**: Are scenes split at natural narrative breaks (location changes, time jumps, new actions)?
2. **Completeness**: Does every part of the script appear in exactly one scene?
3. **Metadata Quality**: Does each scene have meaningful title, duration estimate, location, and time of day?
4. **Script Preservation**: Is the originalScript.extract an exact copy from the input (not modified or enhanced)?
5. **Logical Ordering**: Are sceneNumber values sequential and sceneIds unique?
6. **Single Shot Compliance**: Does each scene represent exactly ONE camera shot (single continuous take)?
   - Check for multi-shot indicators in originalScript.extract:
     * "Cut to", "cuts to", "we cut to"
     * "Then we see", "now we see", "next we see"
     * Multiple camera framings: "Close-up... Wide shot..." in same scene
     * "Meanwhile", "elsewhere", "back to"
   - A scene with ANY of these indicators should have been split further

Score 0 if: Scenes are arbitrarily split, script content is missing, metadata is fabricated, OR scenes contain multiple shots/cuts.
Score 0.5 if: Basic scene splits are correct but metadata is incomplete, script extracts are paraphrased, OR minor multi-shot issues exist.
Score 1 if: Scene boundaries are narratively logical, all script content is preserved exactly, metadata is accurate, AND each scene is a single continuous shot.
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

**Name:** `velro-character-bible-quality`

**Prompt:**

```
You are evaluating the quality of a character bible extracted from script scenes.

## Scene Data:
{{input}}

## Character Bible Output:
{{output}}

## Evaluation Criteria:

1. **Character Coverage**: Are ALL characters mentioned in the scenes identified? (No missing characters)
2. **Physical Description Quality**: Are descriptions detailed enough for visual consistency (hair, build, skin tone, distinguishing features)?
3. **Costume Accuracy**: Are clothing details specific and useful for image generation?
4. **First Appearance Tracking**: Is firstAppearance correctly linked to the right scene with accurate line references?
5. **Consistency Tag Usefulness**: Is the consistencyTag short, memorable, and unique per character?
6. **No Hallucination**: Are all character details actually derivable from the script, not invented?

Score 0 if: Major characters are missing, descriptions are vague ("a man"), or details are fabricated.
Score 0.5 if: Characters are identified but descriptions lack visual specificity or have minor inaccuracies.
Score 1 if: All characters extracted with detailed, accurate, script-grounded descriptions suitable for consistent image generation.
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

**Name:** `velro-visual-prompt-quality`

**Prompt:**

```
You are a CRITICAL prompt quality evaluator. Your job is to find flaws.
A score of 1.0 is RARE - reserved for prompts that would impress a professional cinematographer.
Most AI prompts score 0.5-0.7. Be ruthlessly specific about every weakness.

## Scene Data:
{{input}}

## Visual Prompt Output:
{{output}}

## Scoring Method
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

IMPORTANT: You MUST find at least 2 issues in any prompt. Perfect prompts are extremely rare.
A "good" prompt that accomplishes its goal typically scores 0.7.
```

**Output Schema:**

```json
{
  "score": "Final score after deductions (0.0-1.0, rounded to 1 decimal)",
  "issues": ["List every flaw found, one per item - be specific"],
  "deductions": "Show math: 1.0 - 0.2 (multi-shot) - 0.1 (no lighting) = 0.7",
  "reasoning": "1-2 sentence summary"
}
```

**Filter:** Trace name = `phase-3-visual-prompts` | Tags contain `visual-prompts`

---

## Phase 4: Motion Prompt Evaluator

**Name:** `velro-motion-prompt-quality`

**Prompt:**

```
You are a CRITICAL motion prompt evaluator. Your job is to find flaws.
A score of 1.0 is RARE - reserved for prompts a VFX supervisor would approve.
Most motion prompts score 0.5-0.7. Be ruthlessly specific about every weakness.

## Scene with Visual Prompt:
{{input}}

## Motion Prompt Output:
{{output}}

## Scoring Method
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

IMPORTANT: You MUST find at least 2 issues. A "solid" motion prompt scores 0.7.
Motion prompts are notoriously hard to get right - be skeptical.
```

**Output Schema:**

```json
{
  "score": "Final score after deductions (0.0-1.0, rounded to 1 decimal)",
  "issues": ["List every flaw found, one per item - be specific"],
  "deductions": "Show math: 1.0 - 0.2 (no camera specified) - 0.1 (no timing) = 0.7",
  "reasoning": "1-2 sentence summary"
}
```

**Filter:** Trace name = `phase-4-motion-prompts` | Tags contain `motion-prompts`

---

## Phase 5: Audio Design Evaluator

**Name:** `velro-audio-design-quality`

**Prompt:**

```
You are evaluating the quality of audio design specifications for a video scene.

## Scene Data (with visual/motion context):
{{input}}

## Audio Design Output:
{{output}}

## Evaluation Criteria:

1. **Music Appropriateness**: Does music presence and style match the scene's mood and energy?
2. **Sound Effects Relevance**: Are SFX tied to visible actions or environment in the visual prompt?
3. **Dialogue Accuracy**: If dialogue exists in the original script, is it correctly represented?
4. **Ambient Sound Coherence**: Does ambient audio match the location (indoor/outdoor, urban/natural)?
5. **Spatial Design**: Are sound positions (left/center/right/surround) narratively motivated?
6. **Volume Balance**: Do volume levels (low/medium/high) create appropriate hierarchy?
7. **Timing Precision**: Are SFX timings realistic for the scene duration?

Score 0 if: Audio contradicts the visual scene or includes sounds for non-existent elements.
Score 0.5 if: Audio is generally appropriate but lacks detail or spatial consideration.
Score 1 if: Audio design is comprehensive, spatially aware, and perfectly aligned with visual/motion content.
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

**Name:** `velro-talent-matching-accuracy`

**Prompt:**

```
You are evaluating the accuracy of talent-to-character matching.

## Character Bible:
{{input}}

## Talent Matches Output:
{{output}}

## Evaluation Criteria:

1. **Match Relevance**: Do matched talent physically resemble the character descriptions?
2. **Coverage**: Are all major characters with suggested talent assigned a match (when appropriate)?
3. **No Force-Fitting**: Are unmatched talents correctly left unused rather than forced onto incompatible characters?
4. **Confidence Justification**: Is the matching rationale based on actual visual similarity?
5. **Consistency**: If talent has multiple characteristics, are they all considered?

Score 0 if: Matches are random or ignore physical descriptions entirely.
Score 0.5 if: Matches are reasonable but some are forced or lack clear justification.
Score 1 if: All matches are visually justified and unused talent is appropriately flagged.
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

**Name:** `velro-workflow-coherence`

**Prompt:**

```
You are evaluating the overall coherence of a complete script-to-video analysis workflow.

## Original Script:
{{input}}

## Complete Workflow Output (all phases):
{{output}}

## Evaluation Criteria:

1. **Information Flow**: Does each phase correctly build on previous phases (scenes -> characters -> prompts -> motion -> audio)?
2. **No Contradictions**: Are there any conflicts between phases (e.g., character in audio not in visual)?
3. **Script Fidelity**: Does the final output faithfully represent the original script's intent?
4. **Production Readiness**: Could these outputs directly drive image/video/audio generation?
5. **Consistency Maintenance**: Are character tags and style consistent across all scenes?
6. **Completeness**: Are all scenes fully processed through all applicable phases?

Score 0 if: Major disconnects between phases or script intent is lost.
Score 0.5 if: Workflow is connected but has minor inconsistencies or gaps.
Score 1 if: Seamless flow from script to production-ready outputs with full consistency.
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

**Name:** `velro-image-quality`

**Note:** This evaluator requires a **vision-capable model** (GPT-4o, Claude 3.5 Sonnet, or Gemini Pro Vision) configured in Langfuse.

**Prompt:**

```
You are evaluating the visual quality and aesthetics of an AI-generated image.

## Generation Prompt:
{{prompt}}

## Reference Images (if any):
{{referenceImageUrls}}

## Generated Image:
![image]({{imageUrl}})

## Evaluation Criteria:

1. **Composition**: Is the image well-composed with balanced elements, clear focal points, and appropriate framing?
2. **Lighting Quality**: Is the lighting natural, consistent, and appropriate for the scene?
3. **Clarity & Sharpness**: Is the image crisp and detailed without blur, noise, or artifacts?
4. **Artistic Quality**: Does the image have visual appeal, appropriate color harmony, and professional aesthetics?
5. **Technical Quality**: Is the image free of AI artifacts (distorted hands, text errors, unnatural proportions)?
6. **Reference Consistency** (if reference images provided): Does the generated image maintain visual consistency with the reference images (character appearance, style, etc.)?

Score 0 if: Image has major artifacts, is blurry, has broken anatomy, or is technically unusable.
Score 0.5 if: Image is acceptable but has minor quality issues (slight blur, minor artifacts, or composition problems).
Score 1 if: Image is high quality with excellent composition, lighting, and no visible artifacts.
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

**Name:** `velro-video-quality`

**Note:** This evaluator requires a **vision-capable model** (GPT-4o, Claude 3.5 Sonnet, or Gemini Pro Vision) configured in Langfuse. Video analysis may be limited - the evaluator will assess based on the source image and motion prompt if video cannot be viewed directly.

**Prompt:**

```
You are evaluating the quality of an AI-generated video (image-to-video motion).

## Motion Prompt:
{{prompt}}

## Source Image:
{{sourceImageUrl}}

## Generated Video:
{{videoUrl}}

## Evaluation Criteria:

1. **Motion Quality**: Does the movement appear smooth, natural, and free of jitter or stuttering?
2. **Prompt Adherence**: Does the motion match what was requested in the prompt (camera movement, subject motion)?
3. **Visual Consistency**: Is the subject stable throughout? No flickering, morphing, or unnatural deformations?
4. **Temporal Coherence**: Do frames flow naturally from one to the next without jarring transitions?
5. **Source Fidelity**: Does the video maintain the visual quality and content of the source image?

Score 0 if: Video has severe artifacts, uncontrolled morphing, or motion that contradicts the prompt.
Score 0.5 if: Motion is present but has minor issues (slight jitter, partial prompt adherence, minor flickering).
Score 1 if: Smooth, natural motion that accurately follows the prompt with no visible artifacts.

Note: If you cannot view the video directly, evaluate based on whether the motion prompt is appropriate for the source image and likely to produce good results.
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
