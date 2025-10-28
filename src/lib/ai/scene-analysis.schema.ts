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
  age: z.number().optional(),
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

export const projectMetadataSchema = z.object({
  title: z.string(),
  directorStyle: z.string().optional(),
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
  energy: z.enum(['low', 'medium', 'high']),
});

export const moodTreatmentVariantSchema = z.object({
  id: z.enum(['C1', 'C2', 'C3']),
  description: z.string(),
  tone: z.string(),
});

export const variantsSchema = z.object({
  cameraAngles: z.array(cameraAngleVariantSchema).length(3),
  movementStyles: z.array(movementStyleVariantSchema).length(3),
  moodTreatments: z.array(moodTreatmentVariantSchema).length(3),
});

// ============================================================================
// Selected Variant Schema
// ============================================================================

export const selectedVariantSchema = z.object({
  cameraAngle: z.enum(['A1', 'A2', 'A3']),
  movementStyle: z.enum(['B1', 'B2', 'B3']),
  moodTreatment: z.enum(['C1', 'C2', 'C3']),
  rationale: z.string(),
});

// ============================================================================
// Prompt Component Schemas
// ============================================================================

export const visualPromptComponentsSchema = z.object({
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

export const visualPromptParametersSchema = z.object({
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

export const motionPromptComponentsSchema = z.object({
  cameraMovement: z.string(),
  startPosition: z.string(),
  endPosition: z.string(),
  durationSeconds: z.number(),
  speed: z.string(),
  smoothness: z.string(),
  subjectTracking: z.string(),
  equipment: z.string(),
});

export const motionPromptParametersSchema = z.object({
  durationSeconds: z.number(),
  fps: z.number(),
  motionAmount: z.enum(['low', 'medium', 'high']),
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

export const promptsSchema = z.object({
  visual: visualPromptSchema,
  motion: motionPromptSchema,
});

// ============================================================================
// Audio Design Schemas
// ============================================================================

export const musicSchema = z.object({
  presence: z.enum(['none', 'low', 'medium', 'high']),
  style: z.string().optional(),
  mood: z.string().optional(),
  rationale: z.string().optional(),
});

export const soundEffectSchema = z.object({
  sfxId: z.string(),
  type: z.enum(['ambient', 'foley', 'mechanical', 'natural']),
  description: z.string(),
  timing: z.string(),
  volume: z.enum(['low', 'medium', 'high']),
  spatialPosition: z.enum(['left', 'center', 'right', 'wide', 'surround']),
});

export const dialogueSchema = z.object({
  presence: z.boolean(),
  lines: z.array(z.string()),
});

export const ambientSchema = z.object({
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

export const dialogueLineSchema = z.object({
  character: z.string().nullable(),
  line: z.string(),
});

export const originalScriptSchema = z.object({
  extract: z.string(),
  lineNumber: z.number(),
  dialogue: z.array(dialogueLineSchema),
});

// ============================================================================
// Scene Metadata Schema
// ============================================================================

export const sceneMetadataSchema = z.object({
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
  variants: variantsSchema.optional(),
  selectedVariant: selectedVariantSchema,
  prompts: promptsSchema,
  audioDesign: audioDesignSchema.optional(),
  continuity: continuitySchema.optional(),
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
