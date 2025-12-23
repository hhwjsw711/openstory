import { z } from 'zod';

// ============================================================================
// Character Bible Schemas
// ============================================================================

const firstMentionSchema = z.object({
  sceneId: z.string(),
  originalText: z.string().catch(''),
  lineNumber: z.number().catch(0),
});

export const characterBibleEntrySchema = z.object({
  characterId: z.string(),
  name: z.string(),
  firstMention: firstMentionSchema.optional(),
  age: z.union([z.number(), z.string()]).nullish(), // Accept numbers, age ranges like "30s", null, or undefined
  gender: z.string().optional(),
  ethnicity: z.string().optional(),
  physicalDescription: z.string().catch(''),
  standardClothing: z.string().catch(''),
  distinguishingFeatures: z.string().optional(),
  consistencyTag: z.string().catch(''),
});

// ============================================================================
// Project Metadata Schema
// ============================================================================

const projectMetadataSchema = z.object({
  title: z.string().catch('Untitled'),
  aspectRatio: z.string().catch('16:9'),
  generatedAt: z.string().catch(''),
});

// ============================================================================
// Variant Schemas (A/B/C Options)
// ============================================================================

export const cameraAngleVariantSchema = z.object({
  id: z.enum(['A1', 'A2', 'A3']).catch('A1'),
  description: z.string().catch(''),
  effect: z.string().catch(''),
});

export const movementStyleVariantSchema = z.object({
  id: z.enum(['B1', 'B2', 'B3']).catch('B1'),
  description: z.string().catch(''),
  energy: z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(z.enum(['low', 'medium', 'high']))
    .catch('medium'), // Handle case variations
});

export const moodTreatmentVariantSchema = z.object({
  id: z.enum(['C1', 'C2', 'C3']).catch('C1'),
  description: z.string().catch(''),
  tone: z.string().catch(''),
});

const variantsSchema = z.object({
  cameraAngles: z.array(cameraAngleVariantSchema).min(1).max(5).catch([]),
  movementStyles: z.array(movementStyleVariantSchema).min(1).max(5).optional(),
  moodTreatments: z.array(moodTreatmentVariantSchema).min(1).max(5).catch([]),
});

// ============================================================================
// Selected Variant Schema
// ============================================================================

const selectedVariantSchema = z.object({
  cameraAngle: z.enum(['A1', 'A2', 'A3']).catch('A1'),
  movementStyle: z.enum(['B1', 'B2', 'B3']).optional(),
  moodTreatment: z.enum(['C1', 'C2', 'C3']).catch('C1'),
  rationale: z.string().optional(),
});

// ============================================================================
// Prompt Component Schemas
// ============================================================================

const visualPromptComponentsSchema = z.object({
  sceneDescription: z.string().catch(''),
  subject: z.string().catch(''),
  environment: z.string().catch(''),
  lighting: z.string().catch(''),
  camera: z.string().catch(''),
  composition: z.string().catch(''),
  style: z.string().catch(''),
  technical: z.string().catch(''),
  atmosphere: z.string().catch(''),
});

const visualPromptParametersSchema = z
  .object({
    dimensions: z
      .object({
        width: z.number().optional(),
        height: z.number().optional(),
        aspectRatio: z.string().optional(),
      })
      .optional(),
    quality: z
      .object({
        steps: z.number().optional(),
        guidance: z.number().optional(),
      })
      .optional(),
    control: z
      .object({
        seed: z.number().nullable().optional(),
      })
      .optional(),
  })
  .optional();

export const visualPromptSchema = z.object({
  fullPrompt: z.string().min(1), // STRICT - required for image generation
  negativePrompt: z.string().catch(''),
  components: visualPromptComponentsSchema.optional(),
  parameters: visualPromptParametersSchema,
});

const motionPromptComponentsSchema = z.object({
  cameraMovement: z.string().catch(''),
  startPosition: z.string().catch(''),
  endPosition: z.string().catch(''),
  durationSeconds: z.number().catch(3),
  speed: z.string().catch('medium'),
  smoothness: z.string().catch('smooth'),
  subjectTracking: z.string().catch(''),
  equipment: z.string().catch(''),
});

const motionPromptParametersSchema = z
  .object({
    durationSeconds: z.number().optional(),
    fps: z.number().optional(),
    motionAmount: z
      .string()
      .transform((v) => v.toLowerCase())
      .pipe(z.enum(['low', 'medium', 'high']))
      .optional(),
    cameraControl: z
      .object({
        pan: z.number().optional(),
        tilt: z.number().optional(),
        zoom: z.number().optional(),
        movement: z.string().optional(),
      })
      .optional(),
  })
  .optional();

export const motionPromptSchema = z.object({
  fullPrompt: z.string().min(1), // STRICT - required for motion generation
  components: motionPromptComponentsSchema.optional(),
  parameters: motionPromptParametersSchema,
});

const promptsSchema = z.object({
  visual: visualPromptSchema.optional(),
  motion: motionPromptSchema.optional(),
});

// ============================================================================
// Audio Design Schemas
// ============================================================================

const musicSchema = z.object({
  presence: z.enum(['none', 'minimal', 'moderate', 'full']).catch('none'),
  style: z.string().nullable().catch(''),
  mood: z.string().nullable().catch(''),
  rationale: z.string().optional(),
});

const soundEffectSchema = z.object({
  sfxId: z.string().catch(''),
  type: z.string().catch('ambient'),
  description: z.string().catch(''),
  timing: z.string().catch(''),
  volume: z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(z.enum(['low', 'medium', 'high']))
    .catch('medium'),
  spatialPosition: z.string().catch('center'),
});

const dialogueLineSchema = z.object({
  character: z.string().nullable().catch(null),
  line: z.string().catch(''),
});

const dialogueSchema = z.object({
  presence: z.boolean().catch(false),
  lines: z.array(dialogueLineSchema).catch([]),
});

const ambientSchema = z.object({
  roomTone: z.string().catch(''),
  atmosphere: z.string().catch(''),
});

export const audioDesignSchema = z.object({
  music: musicSchema.optional(),
  soundEffects: z.array(soundEffectSchema).catch([]),
  dialogue: dialogueSchema.optional(),
  ambient: ambientSchema.optional(),
});

// ============================================================================
// Continuity Schema
// ============================================================================

export const continuitySchema = z.object({
  characterTags: z.array(z.string()).catch([]), // Defensive default to empty array
  environmentTag: z.string().optional(),
  colorPalette: z.string().optional(),
  lightingSetup: z.string().optional(),
  styleTag: z.string().optional(),
});

// ============================================================================
// Original Script Schema
// ============================================================================

const originalScriptSchema = z.object({
  extract: z.string().catch(''),
  lineNumber: z.number().catch(0),
  dialogue: z.array(dialogueLineSchema).catch([]),
});

// ============================================================================
// Scene Metadata Schema
// ============================================================================

const sceneMetadataSchema = z.object({
  title: z.string().catch('Untitled Scene'),
  durationSeconds: z.number().catch(3),
  location: z.string().catch(''),
  timeOfDay: z.string().catch(''),
  storyBeat: z.string().catch(''),
});

// ============================================================================
// Scene Schema
// ============================================================================

export const sceneSchema = z.object({
  sceneId: z.string(), // STRICT - required for identity
  sceneNumber: z.number(), // STRICT - required for ordering
  originalScript: originalScriptSchema.optional(),
  metadata: sceneMetadataSchema.optional(),
  variants: variantsSchema.optional(),
  selectedVariant: selectedVariantSchema.optional(),
  prompts: promptsSchema.optional(),
  audioDesign: audioDesignSchema.optional(),
  continuity: continuitySchema.optional(),
  sourceImageUrl: z.string().optional(),
});

// ============================================================================
// Top-Level Scene Analysis Schema
// ============================================================================

export const sceneAnalysisSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']).catch('success'),
  projectMetadata: projectMetadataSchema.optional(),
  characterBible: z.array(characterBibleEntrySchema).optional(),
  scenes: z.array(sceneSchema),
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
