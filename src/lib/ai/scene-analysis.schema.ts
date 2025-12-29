import { z } from 'zod';

// ============================================================================
// Character Bible Schemas
// ============================================================================

export const characterBibleEntrySchema = z.object({
  characterId: z.string().meta({
    description:
      'Unique identifier for cross-referencing this character across scenes',
  }),
  name: z
    .string()
    .meta({ description: 'Full character name as written in the script' }),
  age: z.union([z.number(), z.string()]).nullish().meta({
    description: 'Age as number (e.g., 35) or range (e.g., "30s", "early 40s")',
  }),
  gender: z
    .string()
    .optional()
    .meta({ description: 'Character gender for casting consistency' }),
  ethnicity: z.string().optional().meta({
    description: 'Character ethnicity for accurate visual representation',
  }),
  physicalDescription: z.string().catch('').meta({
    description:
      'Detailed appearance: height, build, hair color, eye color, distinguishing features',
  }),
  standardClothing: z.string().catch('').meta({
    description:
      'Default outfit and clothing style for visual consistency across scenes',
  }),
  distinguishingFeatures: z.string().optional().meta({
    description:
      'Unique visual markers: scars, tattoos, accessories, distinctive mannerisms',
  }),
  consistencyTag: z.string().catch('').meta({
    description:
      'Short prompt tag for image generation (e.g., "detective_sarah_blonde_30s")',
  }),
});

// ============================================================================
// Project Metadata Schema
// ============================================================================

export const projectMetadataSchema = z.object({
  title: z
    .string()
    .catch('Untitled')
    .meta({ description: 'Project title extracted from the script' }),
  aspectRatio: z
    .string()
    .catch('16:9')
    .meta({ description: 'Video aspect ratio (e.g., "16:9", "9:16", "1:1")' }),
  generatedAt: z
    .string()
    .catch('')
    .meta({ description: 'ISO 8601 timestamp of generation' }),
});

// ============================================================================
// Variant Schemas (A/B/C Options)
// ============================================================================

export const cameraAngleVariantSchema = z.object({
  id: z
    .enum(['A1', 'A2', 'A3'])
    .catch('A1')
    .meta({ description: 'Camera angle option identifier (A1, A2, or A3)' }),
  description: z.string().catch('').meta({
    description:
      'Description of the camera angle (e.g., "wide establishing shot")',
  }),
  effect: z
    .string()
    .catch('')
    .meta({ description: 'Visual/emotional effect of this angle' }),
});

export const movementStyleVariantSchema = z.object({
  id: z
    .enum(['B1', 'B2', 'B3'])
    .catch('B1')
    .meta({ description: 'Movement style option identifier (B1, B2, or B3)' }),
  description: z.string().catch('').meta({
    description: 'Description of camera movement (e.g., "slow dolly forward")',
  }),
  energy: z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(z.enum(['low', 'medium', 'high']))
    .catch('medium')
    .meta({
      description: 'Energy level of the movement: low, medium, or high',
    }),
});

export const moodTreatmentVariantSchema = z.object({
  id: z
    .enum(['C1', 'C2', 'C3'])
    .catch('C1')
    .meta({ description: 'Mood treatment option identifier (C1, C2, or C3)' }),
  description: z
    .string()
    .catch('')
    .meta({ description: 'Description of the mood/atmosphere treatment' }),
  tone: z
    .string()
    .catch('')
    .meta({ description: 'Emotional tone (e.g., "tense", "hopeful")' }),
});

export const variantsSchema = z.object({
  cameraAngles: z
    .array(cameraAngleVariantSchema)
    .min(1)
    .max(5)
    .catch([])
    .meta({ description: 'Array of camera angle options (A1, A2, A3)' }),
  movementStyles: z
    .array(movementStyleVariantSchema)
    .min(1)
    .max(5)
    .catch([])
    .meta({ description: 'Array of movement style options (B1, B2, B3)' }),
  moodTreatments: z
    .array(moodTreatmentVariantSchema)
    .min(1)
    .max(5)
    .catch([])
    .meta({ description: 'Array of mood treatment options (C1, C2, C3)' }),
});

// ============================================================================
// Selected Variant Schema
// ============================================================================

export const selectedVariantSchema = z.object({
  cameraAngle: z
    .enum(['A1', 'A2', 'A3'])
    .catch('A1')
    .meta({ description: 'Selected camera angle option (A1, A2, or A3)' }),
  movementStyle: z
    .enum(['B1', 'B2', 'B3'])
    .catch('B1')
    .meta({ description: 'Selected movement style option (B1, B2, or B3)' }),
  moodTreatment: z
    .enum(['C1', 'C2', 'C3'])
    .catch('C1')
    .meta({ description: 'Selected mood treatment option (C1, C2, or C3)' }),
  rationale: z
    .string()
    .catch('')
    .meta({ description: 'Explanation for why these variants were chosen' }),
});

// ============================================================================
// Prompt Schemas
// ============================================================================

export const visualPromptComponentsSchema = z.object({
  sceneDescription: z
    .string()
    .catch('')
    .meta({ description: 'Overall scene action and composition description' }),
  subject: z
    .string()
    .catch('')
    .meta({ description: 'Main subject or character focus' }),
  environment: z
    .string()
    .catch('')
    .meta({ description: 'Setting, location, and background details' }),
  lighting: z
    .string()
    .catch('')
    .meta({ description: 'Light sources, quality, direction, and mood' }),
  camera: z
    .string()
    .catch('')
    .meta({ description: 'Camera angle, lens choice, and framing' }),
  composition: z
    .string()
    .catch('')
    .meta({ description: 'Visual arrangement and focal points' }),
  style: z
    .string()
    .catch('')
    .meta({ description: 'Artistic style and visual treatment' }),
  technical: z.string().catch('').meta({
    description: 'Technical parameters: resolution, quality settings',
  }),
  atmosphere: z
    .string()
    .catch('')
    .meta({ description: 'Mood, emotion, and ambient feeling' }),
});

export const visualPromptSchema = z.object({
  fullPrompt: z.string().min(1).meta({
    description: 'Complete image generation prompt with all visual details',
  }),
  negativePrompt: z
    .string()
    .catch('')
    .meta({ description: 'Elements to avoid in the generated image' }),
  components: visualPromptComponentsSchema.meta({
    description: 'Structured breakdown of the visual prompt components',
  }),
});

export const motionPromptComponentsSchema = z.object({
  cameraMovement: z.string().catch('').meta({
    description: 'Type of camera motion (pan, tilt, dolly, truck, zoom)',
  }),
  startPosition: z
    .string()
    .catch('')
    .meta({ description: 'Camera starting position and framing' }),
  endPosition: z
    .string()
    .catch('')
    .meta({ description: 'Camera ending position and framing' }),
  durationSeconds: z
    .number()
    .catch(3)
    .meta({ description: 'Shot duration in seconds (typically 3-10)' }),
  speed: z
    .string()
    .catch('medium')
    .meta({ description: 'Movement speed: slow, medium, fast' }),
  smoothness: z.string().catch('smooth').meta({
    description: 'Motion quality: jerky, natural, smooth, ultra-smooth',
  }),
  subjectTracking: z
    .string()
    .catch('')
    .meta({ description: 'How camera follows subject movement' }),
  equipment: z.string().catch('').meta({
    description: 'Suggested equipment: handheld, gimbal, dolly, crane',
  }),
});

export const motionPromptParametersSchema = z
  .object({
    durationSeconds: z
      .number()
      .optional()
      .meta({ description: 'Override duration in seconds' }),
    fps: z
      .number()
      .optional()
      .meta({ description: 'Frames per second (24, 30, 60)' }),
    motionAmount: z
      .string()
      .transform((v) => v.toLowerCase())
      .pipe(z.enum(['low', 'medium', 'high']))
      .optional()
      .meta({ description: 'Amount of motion: low, medium, high' }),
    cameraControl: z
      .object({
        pan: z
          .number()
          .optional()
          .meta({ description: 'Horizontal rotation in degrees' }),
        tilt: z
          .number()
          .optional()
          .meta({ description: 'Vertical rotation in degrees' }),
        zoom: z
          .number()
          .optional()
          .meta({ description: 'Zoom factor (1.0 = no zoom)' }),
        movement: z
          .string()
          .optional()
          .meta({ description: 'Direction of camera movement' }),
      })
      .optional()
      .meta({ description: 'Precise camera control parameters' }),
  })
  .optional();

export const motionPromptSchema = z.object({
  fullPrompt: z.string().min(1).meta({
    description: 'Complete motion prompt describing camera movement and action',
  }),
  components: motionPromptComponentsSchema
    .optional()
    .meta({ description: 'Structured breakdown of motion prompt components' }),
  parameters: motionPromptParametersSchema.meta({
    description: 'Technical parameters for motion generation',
  }),
});

export const promptsSchema = z.object({
  visual: visualPromptSchema
    .optional()
    .meta({ description: 'Image generation prompt data' }),
  motion: motionPromptSchema
    .optional()
    .meta({ description: 'Motion/video generation prompt data' }),
});

// ============================================================================
// Audio Design Schemas
// ============================================================================

export const musicSchema = z.object({
  presence: z.enum(['none', 'minimal', 'moderate', 'full']).catch('none').meta({
    description:
      'How prominent the music should be: none, minimal, moderate, full',
  }),
  style: z.string().nullable().catch('').meta({
    description:
      'Music genre or style (e.g., "orchestral", "electronic ambient")',
  }),
  mood: z.string().nullable().catch('').meta({
    description: 'Emotional quality of the music (e.g., "tense", "uplifting")',
  }),
  rationale: z
    .string()
    .optional()
    .meta({ description: 'Explanation for the music choices' }),
});

export const soundEffectSchema = z.object({
  sfxId: z
    .string()
    .catch('')
    .meta({ description: 'Unique identifier for this sound effect' }),
  type: z.string().catch('ambient').meta({
    description: 'Sound effect category (e.g., "ambient", "foley", "impact")',
  }),
  description: z.string().catch('').meta({
    description: 'Description of the sound (e.g., "distant thunder rumble")',
  }),
  timing: z.string().catch('').meta({
    description: 'When the sound plays (e.g., "scene start", "on action")',
  }),
  volume: z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(z.enum(['low', 'medium', 'high']))
    .catch('medium')
    .meta({ description: 'Relative volume level: low, medium, high' }),
  spatialPosition: z
    .string()
    .catch('center')
    .meta({ description: 'Audio positioning: left, center, right, surround' }),
});

export const dialogueLineSchema = z.object({
  character: z.string().nullable().catch(null).meta({
    description: 'Character name speaking the line, or null for narrator',
  }),
  line: z.string().catch('').meta({ description: 'The spoken dialogue text' }),
});

export const dialogueSchema = z.object({
  presence: z
    .boolean()
    .catch(false)
    .meta({ description: 'Whether dialogue is present in scene' }),
  lines: z
    .array(dialogueLineSchema)
    .catch([])
    .meta({ description: 'Array of dialogue lines in the scene' }),
});

export const ambientSchema = z.object({
  roomTone: z.string().catch('').meta({
    description: 'Background room ambience (e.g., "quiet office hum")',
  }),
  atmosphere: z.string().catch('').meta({
    description: 'Environmental atmosphere (e.g., "busy city street")',
  }),
});

export const audioDesignSchema = z.object({
  music: musicSchema
    .optional()
    .meta({ description: 'Background music specifications' }),
  soundEffects: z
    .array(soundEffectSchema)
    .catch([])
    .meta({ description: 'Array of sound effects for the scene' }),
  dialogue: dialogueSchema
    .optional()
    .meta({ description: 'Dialogue and speech specifications' }),
  ambient: ambientSchema
    .optional()
    .meta({ description: 'Ambient sound design' }),
});

// ============================================================================
// Continuity Schema
// ============================================================================

export const continuitySchema = z.object({
  characterTags: z.array(z.string()).catch([]).meta({
    description: 'List of character consistency tags appearing in this scene',
  }),
  environmentTag: z
    .string()
    .optional()
    .meta({ description: 'Location/setting tag for environment consistency' }),
  colorPalette: z
    .string()
    .optional()
    .meta({ description: 'Dominant colors for visual continuity' }),
  lightingSetup: z.string().optional().meta({
    description: 'Lighting configuration for consistency across shots',
  }),
  styleTag: z
    .string()
    .optional()
    .meta({ description: 'Visual style reference for consistent look' }),
});

// ============================================================================
// Original Script Schema
// ============================================================================

export const originalScriptSchema = z.object({
  extract: z
    .string()
    .catch('')
    .meta({ description: 'Original script text for this scene' }),
  dialogue: z
    .array(dialogueLineSchema)
    .catch([])
    .meta({ description: 'Dialogue lines extracted from the script' }),
});

// ============================================================================
// Scene Metadata Schema
// ============================================================================

export const sceneMetadataSchema = z.object({
  title: z
    .string()
    .catch('Untitled Scene')
    .meta({ description: 'Short descriptive scene title' }),
  durationSeconds: z.number().catch(3).meta({
    description: 'Estimated scene duration in seconds (typically 3-10)',
  }),
  location: z
    .string()
    .catch('')
    .meta({ description: 'Scene location (e.g., "INT. OFFICE - DAY")' }),
  timeOfDay: z
    .string()
    .catch('')
    .meta({ description: 'Time of day: day, night, dawn, dusk, etc.' }),
  storyBeat: z
    .string()
    .catch('')
    .meta({ description: 'Narrative purpose of this scene in the story' }),
});

// ============================================================================
// Scene Schema
// ============================================================================

export const sceneSchema = z.object({
  sceneId: z
    .string()
    .meta({ description: 'Unique identifier for this scene (required)' }),
  sceneNumber: z
    .number()
    .meta({ description: 'Scene order number starting from 1 (required)' }),
  originalScript: originalScriptSchema
    .optional()
    .meta({ description: 'Original script content for this scene' }),
  metadata: sceneMetadataSchema
    .optional()
    .meta({ description: 'Scene metadata and context' }),
  variants: variantsSchema
    .optional()
    .meta({ description: 'Camera, movement, and mood options' }),
  selectedVariant: selectedVariantSchema
    .optional()
    .meta({ description: 'Currently selected variant options' }),
  prompts: promptsSchema
    .optional()
    .meta({ description: 'Visual and motion generation prompts' }),
  audioDesign: audioDesignSchema
    .optional()
    .meta({ description: 'Audio and sound design specs' }),
  continuity: continuitySchema
    .optional()
    .meta({ description: 'Continuity tracking for scene consistency' }),
  sourceImageUrl: z
    .string()
    .optional()
    .meta({ description: 'URL of generated or uploaded source image' }),
});

// ============================================================================
// Top-Level Scene Analysis Schema
// ============================================================================

export const sceneAnalysisSchema = z.object({
  status: z
    .enum(['success', 'error', 'rejected'])
    .catch('success')
    .meta({ description: 'Processing status: success, error, or rejected' }),
  projectMetadata: projectMetadataSchema
    .optional()
    .meta({ description: 'Project-level metadata extracted from script' }),
  characterBible: z
    .array(characterBibleEntrySchema)
    .optional()
    .meta({ description: 'Character descriptions for visual consistency' }),
  scenes: z
    .array(sceneSchema)
    .meta({ description: 'Array of analyzed scenes from the script' }),
});

// ============================================================================
// TypeScript Type Export
// ============================================================================

export type SceneAnalysis = z.infer<typeof sceneAnalysisSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type CharacterBibleEntry = z.infer<typeof characterBibleEntrySchema>;
export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;
export type VisualPrompt = z.infer<typeof visualPromptSchema>;
export type MotionPrompt = z.infer<typeof motionPromptSchema>;
export type AudioDesign = z.infer<typeof audioDesignSchema>;
export type Continuity = z.infer<typeof continuitySchema>;
