/**
 * Type definitions for QStash Workflows
 */

import type { IMAGE_TO_VIDEO_MODELS } from "@/lib/ai/models";
import type { Json } from "@/types/database";

/**
 * Base workflow context that includes authentication
 * All workflows must include userId and teamId for authorization
 */
export interface WorkflowContext {
  userId: string;
  teamId: string;
}

/**
 * Image generation workflow input
 */
export interface ImageWorkflowInput extends WorkflowContext {
  prompt: string;
  style?: Json;
  model?: string;
  width?: number;
  height?: number;
  imageSize?: string;
  numImages?: number;
  seed?: number;
  frameId?: string; // Optional: update frame thumbnail
  sequenceId?: string;
}

/**
 * Video generation workflow input
 */
export interface VideoWorkflowInput extends WorkflowContext {
  prompt?: string;
  imageUrl?: string; // For image-to-video
  imageData?: string; // Base64 encoded
  model?: string;
  duration?: number;
  aspectRatio?: string; // "16:9", "9:16", etc.
  enableAudio?: boolean;
}

/**
 * Frame generation workflow input
 */
export interface FrameGenerationWorkflowInput extends WorkflowContext {
  sequenceId: string;
  options?: {
    framesPerScene?: number;
    generateThumbnails?: boolean;
    generateDescriptions?: boolean;
    aiProvider?: "openai" | "anthropic" | "openrouter";
    regenerateAll?: boolean;
  };
}

/**
 * Motion generation workflow input
 */
export interface MotionWorkflowInput extends WorkflowContext {
  frameId: string;
  sequenceId: string;
  thumbnailUrl: string;
  prompt?: string;
  model?: keyof typeof IMAGE_TO_VIDEO_MODELS;
  duration?: number;
  fps?: number;
  motionBucket?: number;
}

/**
 * Batch motion generation workflow input
 */
export interface BatchMotionWorkflowInput extends WorkflowContext {
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
export interface ScriptWorkflowInput extends WorkflowContext {
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
  imageUrl?: string;
  thumbnailUrl?: string;
  frameId?: string;
  sequenceId?: string;
}

export interface VideoWorkflowResult {
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
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
