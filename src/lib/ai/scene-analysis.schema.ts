import { z } from 'zod';

// ============================================================================
// Character Bible Schemas
// ============================================================================

const firstMentionSchema = z.object({
  sceneId: z.string(),
  originalText: z.string(),
  lineNumber: z.number(),
});

export const characterBibleEntrySchema = z.object({
  characterId: z.string(),
  name: z.string(),
  firstMention: firstMentionSchema,
  age: z.union([z.number(), z.string()]).optional(), // Accept both numbers and age ranges like "30s"
  gender: z.string().optional(),
  ethnicity: z.string().optional(),
  physicalDescription: z.string(),
  standardClothing: z.string(),
  distinguishingFeatures: z.string().optional(),
  consistencyTag: z.string(),
});

// ============================================================================
// Project Metadata Schema
// ============================================================================

const projectMetadataSchema = z.object({
  title: z.string(),
  aspectRatio: z.string(),
  generatedAt: z.string(),
});

// ============================================================================
// Variant Schemas (A/B/C Options)
// ============================================================================

export const cameraAngleVariantSchema = z.object({
  id: z.enum(['A1', 'A2', 'A3']),
  description: z.string(),
  effect: z.string(),
});

export const movementStyleVariantSchema = z.object({
  id: z.enum(['B1', 'B2', 'B3']),
  description: z.string(),
  energy: z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(z.enum(['low', 'medium', 'high']))
    .catch('medium'), // Handle case variations
});

export const moodTreatmentVariantSchema = z.object({
  id: z.enum(['C1', 'C2', 'C3']),
  description: z.string(),
  tone: z.string(),
});

const variantsSchema = z.object({
  cameraAngles: z.array(cameraAngleVariantSchema).length(3),
  movementStyles: z.array(movementStyleVariantSchema).length(3).optional(), // Added in phase 4
  moodTreatments: z.array(moodTreatmentVariantSchema).length(3),
});

// ============================================================================
// Selected Variant Schema
// ============================================================================

const selectedVariantSchema = z.object({
  cameraAngle: z.enum(['A1', 'A2', 'A3']),
  movementStyle: z.enum(['B1', 'B2', 'B3']).optional(), // Added in phase 4
  moodTreatment: z.enum(['C1', 'C2', 'C3']),
  rationale: z.string().optional(), // Complete only when all selections made
});

// ============================================================================
// Prompt Component Schemas
// ============================================================================

const visualPromptComponentsSchema = z.object({
  sceneDescription: z.string(),
  subject: z.string(),
  environment: z.string(),
  lighting: z.string(),
  camera: z.string(),
  composition: z.string(),
  style: z.string(),
  technical: z.string(),
  atmosphere: z.string(),
});

const visualPromptParametersSchema = z.object({
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
    aspectRatio: z.string(),
  }),
  quality: z.object({
    steps: z.number(),
    guidance: z.number(),
  }),
  control: z.object({
    seed: z.number().nullable(),
  }),
});

export const visualPromptSchema = z.object({
  fullPrompt: z.string(),
  negativePrompt: z.string(),
  components: visualPromptComponentsSchema,
  parameters: visualPromptParametersSchema,
});

const motionPromptComponentsSchema = z.object({
  cameraMovement: z.string(),
  startPosition: z.string(),
  endPosition: z.string(),
  durationSeconds: z.number(),
  speed: z.string(),
  smoothness: z.string(),
  subjectTracking: z.string(),
  equipment: z.string(),
});

const motionPromptParametersSchema = z.object({
  durationSeconds: z.number(),
  fps: z.number(),
  motionAmount: z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(z.enum(['low', 'medium', 'high']))
    .catch('medium'), // Handle case variations
  cameraControl: z.object({
    pan: z.number(),
    tilt: z.number(),
    zoom: z.number(),
    movement: z.string(),
  }),
});

export const motionPromptSchema = z.object({
  fullPrompt: z.string(),
  components: motionPromptComponentsSchema,
  parameters: motionPromptParametersSchema,
});

const promptsSchema = z.object({
  visual: visualPromptSchema.optional(), // Added in phase 3
  motion: motionPromptSchema.optional(), // Added in phase 4
});

// ============================================================================
// Audio Design Schemas
// ============================================================================

const musicSchema = z.object({
  presence: z.enum(['none', 'minimal', 'moderate', 'full']),
  style: z.string().nullable().default('').optional(), // Handle null when no music
  mood: z.string().nullable().default('').optional(), // Handle null when no music
  rationale: z.string().optional(),
});

const soundEffectSchema = z.object({
  sfxId: z.string(),
  type: z.string().catch('ambient'), // Accept any string, default to ambient
  description: z.string(),
  timing: z.string(),
  volume: z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(z.enum(['low', 'medium', 'high']))
    .catch('medium'), // Handle case variations
  spatialPosition: z.string().catch('center'), // Accept any string, default to center
});

const dialogueLineSchema = z.object({
  character: z.string().nullable(),
  line: z.string(),
});

const dialogueSchema = z.object({
  presence: z.boolean(),
  lines: z.array(dialogueLineSchema),
});

const ambientSchema = z.object({
  roomTone: z.string(),
  atmosphere: z.string(),
});

export const audioDesignSchema = z.object({
  music: musicSchema.optional(),
  soundEffects: z.array(soundEffectSchema).optional(),
  dialogue: dialogueSchema.optional(),
  ambient: ambientSchema.optional(),
});

// ============================================================================
// Continuity Schema
// ============================================================================

export const continuitySchema = z.object({
  characterTags: z.array(z.string()).optional(),
  environmentTag: z.string().optional(),
  colorPalette: z.string().optional(),
  lightingSetup: z.string().optional(),
  styleTag: z.string().optional(),
});

// ============================================================================
// Original Script Schema
// ============================================================================

const originalScriptSchema = z.object({
  extract: z.string(),
  lineNumber: z.number(),
  dialogue: z.array(dialogueLineSchema),
});

// ============================================================================
// Scene Metadata Schema
// ============================================================================

const sceneMetadataSchema = z.object({
  title: z.string(),
  durationSeconds: z.number(),
  location: z.string(),
  timeOfDay: z.string(),
  storyBeat: z.string(),
});

// ============================================================================
// Scene Schema
// ============================================================================

export const sceneSchema = z.object({
  sceneId: z.string(),
  sceneNumber: z.number(),
  originalScript: originalScriptSchema,
  metadata: sceneMetadataSchema,
  variants: variantsSchema.optional(), // Added progressively in phases 3-4
  selectedVariant: selectedVariantSchema.optional(), // Added in phase 3, completed in phase 4
  prompts: promptsSchema.optional(), // Added progressively in phases 3-4
  audioDesign: audioDesignSchema.optional(), // Added in phase 5
  continuity: continuitySchema.optional(), // Added in phase 3
  sourceImageUrl: z.string().optional(), // Temporary FAL URL for API calls
});

// ============================================================================
// Top-Level Scene Analysis Schema
// ============================================================================

export const sceneAnalysisSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']),
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
