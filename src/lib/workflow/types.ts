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
  Scene,
} from '@/lib/ai/scene-analysis.schema';
import type { AspectRatio, ImageSize } from '@/lib/constants/aspect-ratios';
import type { DirectorDnaConfig } from '@/lib/services/director-dna-types';
import type { Json } from '@/types/database';

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
  referenceImageUrls?: string[];
}

/**
 * Image generation workflow input
 */
export interface VariantWorkflowInput extends Partial<SequenceWorkflowContext> {
  thumbnailUrl: string;
  model?: keyof typeof IMAGE_MODELS;
  imageSize?: ImageSize;
  numImages?: number;
  seed?: number;
  frameId?: string;
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
}

/**
 * Character sheet generation workflow input
 */
export interface CharacterBibleWorkflowInput extends Partial<SequenceWorkflowContext> {
  // Character bible from script analysis
  characterBible: CharacterBibleEntry[];

  /** Image model to use (defaults to nano_banana_pro) */
  imageModel?: TextToImageModel;
}

export interface VisualPromptWorkflowInput extends Partial<SequenceWorkflowContext> {
  scenes: Scene[];
  aspectRatio: AspectRatio;
  characterBible: CharacterBibleEntry[];
  styleConfig: DirectorDnaConfig;
  analysisModelId: AnalysisModelId;
  imageModel?: TextToImageModel;
  frameMapping: { sceneId: string; frameId: string }[];
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
