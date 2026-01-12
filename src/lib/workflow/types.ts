/**
 * Type definitions for QStash Workflows
 */

import type {
  IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
  ImageToVideoModel,
  TextToImageModel,
} from '@/lib/ai/models';
import type { AnalysisModelId } from '@/lib/ai/models.config';
import type {
  CharacterBibleEntry,
  LocationBibleEntry,
  Scene,
} from '@/lib/ai/scene-analysis.schema';
import type { AspectRatio, ImageSize } from '@/lib/constants/aspect-ratios';
import type { DirectorDnaConfig } from '@/lib/services/director-dna-types';
import type { Json } from '@/types/database';
import type { ReferenceImageDescription } from '@/lib/prompts/reference-image-prompt';

/**
 * Base workflow context that includes authentication
 * All workflows must include userId and teamId for authorization
 */
export interface UserWorkflowContext {
  userId: string;
  teamId: string;
}

export interface SequenceWorkflowContext extends UserWorkflowContext {
  sequenceId: string;
}
/**
 * Image generation workflow input
 */
export interface ImageWorkflowInput extends Partial<SequenceWorkflowContext> {
  prompt: string;
  style?: Json;
  model?: keyof typeof IMAGE_MODELS;
  width?: number;
  height?: number;
  imageSize?: ImageSize;
  numImages?: number;
  seed?: number;
  frameId?: string; // Optional: update frame thumbnail
  /** Reference images for character consistency (auto-switches to edit endpoint) */
  referenceImages?: ReferenceImageDescription[];
}

/**
 * Variant image generation workflow input
 */
export interface VariantWorkflowInput extends Partial<SequenceWorkflowContext> {
  thumbnailUrl: string;
  model?: keyof typeof IMAGE_MODELS;
  imageSize?: ImageSize;
  numImages?: number;
  seed?: number;
  frameId?: string;
  /** Character reference sheets for visual consistency */
  characterReferences?: ReferenceImageDescription[];
  /** Location reference images for environment consistency */
  locationReferences?: ReferenceImageDescription[];
}

export interface VariantWorkflowResult {
  variantImageUrl: string;
}

/**
 * Video generation workflow input
 */
interface VideoWorkflowInput extends Partial<SequenceWorkflowContext> {
  prompt?: string;
  imageUrl?: string; // For image-to-video
  imageData?: string; // Base64 encoded
  model?: keyof typeof IMAGE_TO_VIDEO_MODELS;
  duration?: number;
  aspectRatio?: string; // "16:9", "9:16", etc.
  enableAudio?: boolean;
}

/**
 * Storyboard generation workflow input
 */
export interface StoryboardWorkflowInput extends SequenceWorkflowContext {
  options?: {
    framesPerScene?: number;
    generateThumbnails?: boolean;
    generateDescriptions?: boolean;
    aiProvider?: 'openai' | 'anthropic' | 'openrouter';
    regenerateAll?: boolean;
  };
  autoGenerateMotion?: boolean;
  /** Talent IDs suggested by user for AI-assisted casting */
  suggestedTalentIds?: string[];
  /** Location IDs suggested by user for visual consistency */
  suggestedLocationIds?: string[];
}

/**
 * Analyze scenes workflow input
 */
export interface AnalyzeScriptWorkflowInput extends Partial<SequenceWorkflowContext> {
  // Required inputs
  script: string;
  aspectRatio: AspectRatio;
  styleConfig: DirectorDnaConfig;
  analysisModelId: AnalysisModelId;
  imageModel?: TextToImageModel;
  videoModel?: ImageToVideoModel;
  autoGenerateMotion?: boolean;
  /** Talent IDs suggested by user for AI-assisted casting */
  suggestedTalentIds?: string[];
  /** Location IDs suggested by user for visual consistency */
  suggestedLocationIds?: string[];
}

/**
 * Motion generation workflow input
 */
export interface MotionWorkflowInput extends Partial<SequenceWorkflowContext> {
  frameId?: string;
  imageUrl: string;
  prompt: string;
  model?: keyof typeof IMAGE_TO_VIDEO_MODELS;
  duration?: number;
  fps?: number;
  motionBucket?: number;
  aspectRatio?: AspectRatio; // "16:9", "9:16", "1:1"
}

/**
 * Batch motion generation workflow input
 */
interface BatchMotionWorkflowInput extends Partial<SequenceWorkflowContext> {
  frameIds?: string[]; // Optional: specific frames to process
  model?: keyof typeof IMAGE_TO_VIDEO_MODELS;
  duration?: number;
  fps?: number;
  motionBucket?: number;
}

/**
 * Character sheet generation workflow input
 */
export interface CharacterSheetWorkflowInput extends Partial<SequenceWorkflowContext> {
  /** sequence_characters.id */
  characterDbId: string;
  /** Character name for logging */
  characterName: string;
  /** Character metadata from script analysis */
  characterMetadata: CharacterBibleEntry;
  /** Image model to use (defaults to nano_banana_pro) */
  imageModel?: TextToImageModel;
  /** Reference image URL (e.g., from talent sheet) for recasting */
  referenceImageUrl?: string;
  /** Talent metadata from talent sheet (for appearance overrides when recasting) */
  talentMetadata?: CharacterBibleEntry;
  /** Talent description to include in prompt */
  talentDescription?: string;
}

/**
 * Regenerate frames workflow input
 * Bulk regenerates images for frames containing specific characters after recast
 */
export interface RegenerateFramesWorkflowInput extends SequenceWorkflowContext {
  /** Frame IDs to regenerate */
  frameIds: string[];
  /** Character ID that triggered regeneration (for logging/tracking) */
  triggeringCharacterId: string;
  /** Image model to use */
  imageModel?: TextToImageModel;
}

/**
 * Recast character workflow input
 * Orchestrates character sheet generation + frame regeneration for recast
 */
export interface RecastCharacterWorkflowInput extends SequenceWorkflowContext {
  /** Character database ID */
  characterDbId: string;
  /** Character name for logging */
  characterName: string;
  /** Character metadata from script analysis */
  characterMetadata: CharacterBibleEntry;
  /** Image model to use */
  imageModel?: TextToImageModel;
  /** Reference image URL from talent sheet */
  referenceImageUrl?: string;
  /** Talent metadata for appearance overrides */
  talentMetadata?: CharacterBibleEntry;
  /** Talent description */
  talentDescription?: string;
  /** Frame IDs to regenerate after sheet generation */
  affectedFrameIds: string[];
}

/**
 * Talent-to-character match result from AI casting
 */
export type TalentCharacterMatch = {
  /** Character ID from CharacterBibleEntry.characterId */
  characterId: string;
  /** Talent database ID */
  talentId: string;
  /** Talent name for logging/display */
  talentName: string;
  /** Talent's default sheet image URL for reference */
  sheetImageUrl: string;
  /** Talent sheet metadata for appearance blending */
  sheetMetadata?: CharacterBibleEntry;
};

/**
 * Result from talent matching service
 */
export type TalentMatchResult = {
  /** Successfully matched talent to characters */
  matches: TalentCharacterMatch[];
  /** Talent IDs that couldn't be matched to any character */
  unusedTalentIds: string[];
  /** Talent names that couldn't be matched (for display) */
  unusedTalentNames: string[];
};

/**
 * Character sheet generation workflow input
 */
export interface CharacterBibleWorkflowInput extends Partial<SequenceWorkflowContext> {
  // Character bible from script analysis
  characterBible: CharacterBibleEntry[];

  /** Image model to use (defaults to nano_banana_pro) */
  imageModel?: TextToImageModel;

  /** Matched talent data for characters that should use talent references */
  talentMatches?: TalentCharacterMatch[];
}

export interface VisualPromptWorkflowInput extends Partial<SequenceWorkflowContext> {
  scenes: Scene[];
  aspectRatio: AspectRatio;
  characterBible: CharacterBibleEntry[];
  locationBible: LocationBibleEntry[];
  styleConfig: DirectorDnaConfig;
  analysisModelId: AnalysisModelId;
  imageModel?: TextToImageModel;
}

export interface VisualPromptSceneWorkflowInput extends VisualPromptWorkflowInput {
  sceneIndex: number;
}

export interface MotionPromptWorkflowInput extends Partial<SequenceWorkflowContext> {
  scenes: Scene[];
  aspectRatio: AspectRatio;
  characterBible: CharacterBibleEntry[];
  styleConfig: DirectorDnaConfig;
  analysisModelId: AnalysisModelId;
  videoModel?: ImageToVideoModel;
}

export interface MotionPromptSceneWorkflowInput extends MotionPromptWorkflowInput {
  sceneIndex: number;
}
/**
 * Script analysis workflow input
 */
interface ScriptWorkflowInput extends Partial<SequenceWorkflowContext> {
  script: string;
  language?: string;
  genre?: string;
}

/**
 * Frame generation result
 */
interface FrameGenerationResult {
  frames: Array<{
    description: string;
    orderIndex: number;
    durationMs: number;
    metadata: {
      scene: number;
      shotType?: string;
      cameraAngle?: string;
      characters?: string[];
      settings?: string[];
      mood?: string;
      generationPrompt?: string;
    };
  }>;
  totalDuration: number;
  frameCount: number;
}

/**
 * Workflow result types
 */
export interface ImageWorkflowResult {
  imageUrl: string;
  frameId?: string;
  sequenceId?: string;
}

export interface MotionWorkflowResult {
  videoUrl: string;
  duration?: number;
}

interface BatchMotionWorkflowResult {
  sequenceId: string;
  processedFrames: string[];
  failedFrames: Array<{ frameId: string; error: string }>;
  totalProcessed: number;
}

export interface CharacterSheetWorkflowResult {
  sheetImageUrl: string;
  characterDbId?: string;
  sheetImagePath?: string;
}

/**
 * Upscale variant workflow input
 * Upscales a cropped variant tile to higher resolution
 */
export interface UpscaleVariantWorkflowInput extends SequenceWorkflowContext {
  frameId: string;
  /** URL of the cropped tile to upscale */
  croppedTileUrl: string;
  /** R2 path of the cropped tile (for replacement) */
  croppedTilePath: string;
}

export interface UpscaleVariantWorkflowResult {
  upscaledUrl: string;
  upscaledPath: string;
}

/**
 * Library talent sheet generation workflow input
 * Generates a talent sheet from reference media uploaded by the user
 */
export interface LibraryTalentSheetWorkflowInput extends UserWorkflowContext {
  /** Talent ID from the library */
  talentId: string;
  /** Talent name for the prompt */
  talentName: string;
  /** Talent description for the prompt */
  talentDescription?: string;
  /** Reference media URLs to use as input (optional - if not provided, generates from name/description) */
  referenceImageUrls?: string[];
  /** Image model to use */
  imageModel?: TextToImageModel;
  /** Name for the generated sheet */
  sheetName?: string;
}

export interface LibraryTalentSheetWorkflowResult {
  sheetId: string;
  sheetImageUrl: string;
  sheetImagePath?: string;
  headshotImageUrl?: string;
  headshotImagePath?: string;
}

/**
 * Merge video workflow input
 * Stitches all frame videos into a single merged video
 */
export interface MergeVideoWorkflowInput extends SequenceWorkflowContext {
  /** Ordered list of video URLs to merge */
  videoUrls: string[];
  /** Target FPS for output (1-60, defaults to lowest of inputs) */
  targetFps?: number;
  /** Target resolution (512-2048 per dimension) */
  resolution?: { width: number; height: number };
}

export interface MergeVideoWorkflowResult {
  mergedVideoUrl: string;
  mergedVideoPath: string | null;
}

/**
 * Location sheet generation workflow input
 */
export interface LocationSheetWorkflowInput extends Partial<SequenceWorkflowContext> {
  /** locations.id */
  locationDbId: string;
  /** Location name for logging */
  locationName: string;
  /** Location metadata from script analysis */
  locationMetadata: LocationBibleEntry;
  /** Image model to use */
  imageModel?: TextToImageModel;
  /** Reference image URL (e.g., from library location) for overrides */
  referenceImageUrl?: string;
  /** Library location description for overrides */
  libraryLocationDescription?: string;
}

export interface LocationSheetWorkflowResult {
  referenceImageUrl: string;
  locationDbId?: string;
  referenceImagePath?: string;
}

/**
 * Library location sheet generation workflow input
 * Generates a 3x3 grid reference sheet from user-uploaded reference images
 */
export interface LibraryLocationSheetWorkflowInput {
  /** locations.id */
  locationDbId: string;
  /** Location name for prompt */
  locationName: string;
  /** Location description for prompt */
  locationDescription?: string;
  /** Reference image URLs (user uploads) */
  referenceImageUrls: string[];
  /** Team ID for storage path */
  teamId: string;
  /** Sequence ID (library sequence) for storage path */
  sequenceId: string;
  /** Image model to use */
  imageModel?: TextToImageModel;
}

export interface LibraryLocationSheetWorkflowResult {
  /** Generated sheet image URL */
  sheetImageUrl: string;
  /** Storage path */
  sheetImagePath?: string;
  /** Location ID */
  locationDbId: string;
}

/**
 * Location bible generation workflow input
 * Generates reference sheets for all locations in a sequence
 */
export interface LocationBibleWorkflowInput extends Partial<SequenceWorkflowContext> {
  /** Location bible from script analysis */
  locationBible: LocationBibleEntry[];
  /** Image model to use */
  imageModel?: TextToImageModel;
  /** Library location matches for locations that should use library references */
  libraryLocationMatches?: LibraryLocationMatch[];
}

/**
 * Library location match result
 */
export type LibraryLocationMatch = {
  /** Location ID from LocationBibleEntry.locationId */
  locationId: string;
  /** Library location database ID */
  libraryLocationId: string;
  /** Library location name */
  libraryLocationName: string;
  /** Library location reference image URL */
  referenceImageUrl: string;
  /** Library location description for prompt enhancement */
  description?: string;
};

/**
 * Regenerate frames workflow input for locations
 * Bulk regenerates images for frames at a specific location after recast
 */
export interface RegenerateLocationFramesWorkflowInput extends SequenceWorkflowContext {
  /** Frame IDs to regenerate */
  frameIds: string[];
  /** Location ID that triggered regeneration (for logging/tracking) */
  triggeringLocationId: string;
  /** Image model to use */
  imageModel?: TextToImageModel;
}

/**
 * Recast location workflow input
 * Orchestrates location sheet generation + frame regeneration for recast
 */
export interface RecastLocationWorkflowInput extends SequenceWorkflowContext {
  /** Location database ID */
  locationDbId: string;
  /** Location name for logging */
  locationName: string;
  /** Location metadata from script analysis */
  locationMetadata: LocationBibleEntry;
  /** Image model to use */
  imageModel?: TextToImageModel;
  /** Reference image URL from library location */
  referenceImageUrl?: string;
  /** Library location description */
  libraryLocationDescription?: string;
  /** Frame IDs to regenerate after sheet generation */
  affectedFrameIds: string[];
}
