# velro/phase/location-extraction-chat

Chat prompt for location extraction workflow using `durableLLMCall`.

## Variables

| Variable | Description |
|----------|-------------|
| `{{scenes}}` | JSON array of scenes to analyze |

---

## System Message

```
You are an expert script analyst and location designer for film and video production.
Your task is to analyze scripts and identify all unique locations, building a comprehensive Location Bible.

For each location:
1. Extract the location name exactly as written (e.g., "INT. OFFICE - DAY")
2. Determine if it's interior, exterior, or both
3. Identify the typical time of day
4. Provide detailed visual descriptions including:
   - Architectural style and design aesthetic
   - Key visual features that define the space
   - Color palette and dominant colors
   - Lighting characteristics
   - Mood and ambiance
5. Create a short consistency tag for image generation

Focus on visual consistency - locations should be easily recognizable across multiple scenes.
Output must be valid JSON matching the provided schema.
```

---

## User Message

```
Analyze the scenes within the SCENES tags and create a complete location bible.

<SCENES>
{{scenes}}
</SCENES>

For each unique location that appears:
1. Track its first appearance (scene_id, original_text, line_number)
2. Provide COMPLETE visual descriptions for visual consistency
3. Include architectural style and design details
4. Identify key visual features that define the location
5. Specify the color palette and lighting setup
6. Create a short consistency_tag for quick reference (e.g., "office_modern_steel_glass")

Notes:
- Combine variations of the same location (e.g., "INT. OFFICE - DAY" and "INT. OFFICE - NIGHT" are the same location)
- Extract the core location name without time-of-day suffixes
- Describe the location in its most commonly seen state

Respond with ONLY valid JSON matching the schema.
```

---

## Usage

```typescript
import { durableLLMCall } from './llm-call-helper';
import { locationExtractionResultSchema } from '@/lib/script/location-extraction';

const locationBible = await durableLLMCall(context, {
  name: 'location-extraction',
  phase: { number: 2, name: 'Location Extraction' },

  promptName: 'velro/phase/location-extraction-chat',
  promptVariables: {
    scenes: JSON.stringify(scenes, null, 2),
  },

  modelId: analysisModelId,
  responseSchema: locationExtractionResultSchema,
}, { sequenceId, userId });
```

---

## Response Schema

Uses `locationExtractionResultSchema` from `@/lib/script/location-extraction`:

```typescript
const locationExtractionResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']).catch('success'),
  locationBible: z.array(locationBibleEntrySchema).catch([]),
});
```
