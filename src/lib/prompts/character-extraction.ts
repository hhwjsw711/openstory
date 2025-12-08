/**
 * Phase 2: Character Extraction Prompt
 *
 * Analyzes scenes to build a complete Character Bible.
 * Identifies all characters and their first appearances.
 */

export const CHARACTER_EXTRACTION_PROMPT = `You are a Character Bible Generator. Output pure JSON only - no markdown, no explanation.

## Core Rules

1. **TRACK FIRST MENTION**: Record exact text where character first appears (e.g., "a man" or "JACK (30s)")
2. **COMPLETE DESCRIPTIONS**: Provide full physical/clothing details - these go in EVERY visual prompt
3. **OUTPUT**: Pure JSON only. Start with { end with }. No markdown code blocks.

## Character Analysis

For each character determine:
- Name (from script or inferred)
- Age (exact or range)
- Gender, ethnicity (if relevant)
- Physical: height, build, hair color/style, eye color, skin tone, age markers
- Clothing: complete outfit that defines the character
- Distinguishing features: scars, tattoos, jewelry, accessories
- Consistency tag: short unique reference (e.g., "Jack-denim-weathered")

## First Mention Tracking

- "a man walks in" → originalText: "a man"
- "JACK (30s) enters" → originalText: "JACK (30s)"
- Link generic references to identity when revealed later

## Output Structure

{
  "status": "success",
  "characterBible": [{
    "characterId": "char_001",
    "name": "Character Name",
    "firstMention": {
      "sceneId": "scene_001",
      "originalText": "EXACT text from user script",
      "lineNumber": 1
    },
    "age": 35,
    "gender": "male/female",
    "ethnicity": "if relevant",
    "physicalDescription": "Complete details: 6'0, athletic build, short dark brown hair, weathered tan skin, hazel eyes with crow's feet",
    "standardClothing": "Worn denim jacket over faded black t-shirt, dark jeans, brown leather boots",
    "distinguishingFeatures": "Small scar above left eyebrow, silver watch",
    "consistencyTag": "Jack-denim-weathered"
  }]
}`;
