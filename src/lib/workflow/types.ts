/**
 * Type definitions for QStash Workflows
 */

import type { IMAGE_MODELS, IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';
import { ImageSize } from '@/lib/constants/aspect-ratios';
import type { Json } from '@/types/database';

/**
 * Base workflow context that includes authentication
 * All workflows must include userId and teamId for authorization
 */
export interface UserWorkflowContext {
  userId: string;
  teamId: string;
}

/**
 * Image generation workflow input
 */
export interface ImageWorkflowInput extends UserWorkflowContext {
  prompt: string;
  style?: Json;
  model?: keyof typeof IMAGE_MODELS;
  width?: number;
  height?: number;
  imageSize?: ImageSize;
  numImages?: number;
  seed?: number;
  frameId?: string; // Optional: update frame thumbnail
  sequenceId?: string;
}

/**
 * Video generation workflow input
 */
export interface VideoWorkflowInput extends UserWorkflowContext {
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
export interface StoryboardWorkflowInput extends UserWorkflowContext {
  sequenceId: string;
  options?: {
    framesPerScene?: number;
    generateThumbnails?: boolean;
    generateDescriptions?: boolean;
    aiProvider?: 'openai' | 'anthropic' | 'openrouter';
    regenerateAll?: boolean;
  };
}

/**
 * Motion generation workflow input
 */
export interface MotionWorkflowInput extends UserWorkflowContext {
  frameId: string;
  sequenceId: string;
  thumbnailPath: string;
  prompt: string;
  model?: keyof typeof IMAGE_TO_VIDEO_MODELS;
  duration?: number;
  fps?: number;
  motionBucket?: number;
  aspectRatio?: string; // "16:9", "9:16", "1:1"
}

/**
 * Batch motion generation workflow input
 */
export interface BatchMotionWorkflowInput extends UserWorkflowContext {
  sequenceId: string;
  frameIds?: string[]; // Optional: specific frames to process
  model?: keyof typeof IMAGE_TO_VIDEO_MODELS;
  duration?: number;
  fps?: number;
  motionBucket?: number;
}

/**
 * Script analysis workflow input
 */
export interface ScriptWorkflowInput extends UserWorkflowContext {
  script: string;
  language?: string;
  genre?: string;
}

/**
 * Frame generation result
 */
export interface FrameGenerationResult {
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
  thumbnailPath: string;
  frameId?: string;
  sequenceId?: string;
}

export interface MotionWorkflowResult {
  frameId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
}

export interface BatchMotionWorkflowResult {
  sequenceId: string;
  processedFrames: string[];
  failedFrames: Array<{ frameId: string; error: string }>;
  totalProcessed: number;
}
