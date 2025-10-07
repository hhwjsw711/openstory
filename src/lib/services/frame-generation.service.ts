/**
 * Frame Generation Service Layer
 *
 * Handles AI-powered frame generation orchestration including script analysis,
 * frame description generation, and async job queueing. Separated from FrameService
 * to keep concerns focused.
 *
 * @module lib/services/frame-generation.service
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateFrameDescriptions } from "@/lib/ai/frame-generator";
import { analyzeScriptForFrames } from "@/lib/ai/script-analyzer";
import { ValidationError } from "@/lib/errors";
import { getQStashClient } from "@/lib/qstash/client";
import { getJobManager } from "@/lib/qstash/job-manager";
import { createServerClient } from "@/lib/supabase/server";
import type { Database, FrameInsert, Json } from "@/types/database";
import { type FrameService, frameService } from "./frame.service";

export interface GenerateFramesParams {
  sequenceId: string;
  userId: string;
  options?: {
    framesPerScene?: number;
    generateThumbnails?: boolean;
    generateDescriptions?: boolean;
    aiProvider?: "openai" | "anthropic" | "openrouter";
    regenerateAll?: boolean;
  };
}

export interface FrameGenerationResult {
  frameCount: number;
  jobId?: string;
  message: string;
}

/**
 * Frame Generation Service Class
 *
 * Orchestrates the AI-powered frame generation process.
 * Assumes caller has verified authentication and authorization.
 */
export class FrameGenerationService {
  private frameService: FrameService;

  constructor(
    private supabase: SupabaseClient<Database> = createServerClient(),
    frameServiceInstance?: FrameService,
  ) {
    this.frameService = frameServiceInstance ?? frameService;
  }

  /**
   * Generate frames for a sequence using AI
   *
   * Phase 1: Quick frame creation (synchronous)
   * Phase 2: Async image generation (queued jobs)
   *
   * @param params - Generation parameters
   * @throws {ValidationError} If sequence not found or invalid
   * @throws {Error} If generation fails
   * @returns Generation result with frame count and job ID
   */
  async generateFrames(
    params: GenerateFramesParams,
  ): Promise<FrameGenerationResult> {
    // Verify sequence exists and get all required data
    const { data: sequence, error: sequenceError } = await this.supabase
      .from("sequences")
      .select("*, styles(*)")
      .eq("id", params.sequenceId)
      .single();

    if (sequenceError || !sequence) {
      throw new ValidationError("Sequence not found");
    }

    if (!sequence.script) {
      throw new ValidationError("Sequence has no script");
    }

    if (!sequence.style_id) {
      throw new ValidationError("Sequence has no style selected");
    }

    // Set sequence status to processing
    await this.updateSequenceStatus(params.sequenceId, "processing", {
      frameGeneration: {
        status: "processing",
        startedAt: new Date().toISOString(),
        expectedFrameCount: null,
        completedFrameCount: 0,
        options: params.options,
        error: null,
        failedAt: null,
      },
    });

    // PHASE 1: Quick frame creation (synchronous)
    console.log(
      "[FrameGenerationService] Phase 1: Analyzing script and creating frames",
    );

    // Step 1: Analyze script to determine frame boundaries
    const scriptAnalysis = await analyzeScriptForFrames(
      sequence.script,
      params.options?.aiProvider,
    );

    if (!scriptAnalysis?.scenes || scriptAnalysis.scenes.length === 0) {
      throw new Error("Failed to analyze script or no scenes found");
    }

    // Step 2: Generate frame descriptions for each scene
    const styleStack =
      sequence.styles && typeof sequence.styles === "object"
        ? (sequence.styles as { metadata?: unknown }).metadata
        : undefined;

    const frameDescriptions = await generateFrameDescriptions({
      scriptAnalysis,
      styleStack: styleStack as Json | undefined,
      aiProvider: params.options?.aiProvider,
    });

    if (!frameDescriptions?.frames || frameDescriptions.frames.length === 0) {
      throw new Error("Failed to generate frame descriptions");
    }

    // Step 3: Handle existing frames
    const regenerateAll = params.options?.regenerateAll !== false; // Default to true

    if (regenerateAll) {
      await this.frameService.deleteFramesBySequence(params.sequenceId);
    }

    // Step 4: Insert the generated frames
    const framesToInsert: FrameInsert[] = frameDescriptions.frames.map(
      (frame) => ({
        sequence_id: params.sequenceId,
        description: frame.description,
        order_index: frame.orderIndex,
        duration_ms: frame.durationMs,
        metadata: {
          ...frame.metadata,
          generatedAt: new Date().toISOString(),
          aiProvider: params.options?.aiProvider || "openai",
        } as Json,
      }),
    );

    const insertedFrames =
      await this.frameService.bulkInsertFrames(framesToInsert);

    // Update sequence metadata with frame count
    await this.updateSequenceStatus(params.sequenceId, "processing", {
      frameGeneration: {
        status: "processing",
        startedAt: new Date().toISOString(),
        expectedFrameCount: insertedFrames.length,
        completedFrameCount: 0,
        options: params.options,
        error: null,
        failedAt: null,
      },
    });

    // PHASE 2: Queue individual image generation jobs for each frame
    if (params.options?.generateThumbnails !== false) {
      console.log(
        "[FrameGenerationService] Phase 2: Queueing image generation for frames",
      );

      const qstashClient = getQStashClient();
      const jobManager = getJobManager();
      const imageGenerationPromises = [];
      const defaultModel = "flux_krea_lora";
      const defaultImageSize = "landscape_16_9";

      for (const frame of insertedFrames) {
        // Skip frames without descriptions
        if (!frame.description) {
          continue;
        }

        // Create an image generation job for each frame
        const imageJob = await jobManager.createJob({
          type: "image",
          payload: {
            frameId: frame.id,
            sequenceId: params.sequenceId,
            prompt: frame.description,
            model: defaultModel,
            image_size: defaultImageSize,
            num_images: 1,
          },
          userId: params.userId,
          teamId: sequence.team_id,
        });

        // Queue the image generation job
        const imagePayload = {
          jobId: imageJob.id,
          type: "image" as const,
          userId: params.userId,
          teamId: sequence.team_id,
          data: {
            frameId: frame.id,
            sequenceId: params.sequenceId,
            prompt: frame.description,
            model: defaultModel,
            image_size: defaultImageSize,
            num_images: 1,
            // Add style information if available
            style: styleStack as Json | undefined,
          },
        };

        imageGenerationPromises.push(
          qstashClient
            .publishImageJob(imagePayload, {
              delay: 0, // Process immediately
            })
            .then((response) => {
              console.log("[FrameGenerationService] Image job queued", {
                frameId: frame.id,
                imageJobId: imageJob.id,
                messageId: response.messageId,
              });
              return { frameId: frame.id, imageJobId: imageJob.id };
            }),
        );
      }

      // Wait for all image jobs to be queued
      try {
        await Promise.all(imageGenerationPromises);
        console.log(
          "[FrameGenerationService] All image generation jobs queued",
          {
            count: imageGenerationPromises.length,
          },
        );
      } catch (error) {
        console.error(
          "[FrameGenerationService] Failed to queue some image jobs",
          error,
        );
        // Don't fail the entire operation if image queueing fails
      }

      // Update sequence status - frames created, images generating
      // Set status to "draft" to stop polling, but mark thumbnails as generating
      await this.updateSequenceStatus(params.sequenceId, "draft", {
        frameGeneration: {
          status: "generating_thumbnails",
          startedAt: new Date().toISOString(),
          expectedFrameCount: insertedFrames.length,
          completedFrameCount: insertedFrames.length,
          thumbnailsGenerating: true,
          options: params.options,
          error: null,
          failedAt: null,
        },
      });
    } else {
      // If not generating thumbnails, mark sequence as complete
      await this.updateSequenceStatus(params.sequenceId, "draft", {
        frameGeneration: {
          status: "completed",
          startedAt: new Date().toISOString(),
          expectedFrameCount: insertedFrames.length,
          completedFrameCount: insertedFrames.length,
          thumbnailsGenerating: false,
          options: params.options,
          error: null,
          failedAt: null,
        },
      });
    }

    return {
      frameCount: insertedFrames.length,
      message:
        params.options?.generateThumbnails !== false
          ? `Created ${insertedFrames.length} frames. Thumbnail generation is in progress.`
          : `Created ${insertedFrames.length} frames.`,
    };
  }

  /**
   * Update sequence status and metadata
   *
   * @param sequenceId - The sequence ID
   * @param status - The new status
   * @param metadata - Additional metadata to merge
   * @throws {Error} If database operation fails
   */
  private async updateSequenceStatus(
    sequenceId: string,
    status: "draft" | "processing" | "completed" | "failed" | "archived",
    metadata: Record<string, unknown>,
  ): Promise<void> {
    // Get current metadata
    const { data: sequence } = await this.supabase
      .from("sequences")
      .select("metadata")
      .eq("id", sequenceId)
      .single();

    const currentMetadata =
      (sequence?.metadata as Record<string, unknown>) || {};

    const { error } = await this.supabase
      .from("sequences")
      .update({
        status,
        metadata: {
          ...currentMetadata,
          ...metadata,
        } as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sequenceId);

    if (error) {
      throw new Error(`Failed to update sequence status: ${error.message}`);
    }
  }

  /**
   * Regenerate a single frame's thumbnail
   *
   * @param frameId - The frame ID
   * @param userId - The user ID
   * @param teamId - The team ID
   * @param options - Regeneration options
   * @throws {ValidationError} If frame not found
   * @throws {Error} If regeneration fails
   * @returns Job ID for async processing
   */
  async regenerateFrame(
    frameId: string,
    userId: string,
    teamId: string,
    options?: {
      model?: string;
      image_size?: string;
    },
  ): Promise<string> {
    const frame = await this.frameService.getFrame(frameId);

    if (!frame) {
      throw new ValidationError("Frame not found");
    }

    if (!frame.description) {
      throw new ValidationError("Frame has no description to regenerate from");
    }

    // Create job for image regeneration
    const jobManager = getJobManager();
    const qstashClient = getQStashClient();

    const job = await jobManager.createJob({
      type: "image",
      payload: {
        frameId,
        sequenceId: frame.sequence_id,
        prompt: frame.description,
        model: options?.model || "flux_krea_lora",
        image_size: options?.image_size || "landscape_16_9",
        num_images: 1,
      },
      userId,
      teamId,
    });

    // Queue the image generation job using the typed helper
    const payload = {
      jobId: job.id,
      type: "image" as const,
      userId,
      teamId,
      data: {
        frameId,
        sequenceId: frame.sequence_id,
        prompt: frame.description,
        model: options?.model || "flux_krea_lora",
        image_size: options?.image_size || "landscape_16_9",
        num_images: 1,
      },
    };

    await qstashClient.publishImageJob(payload, {
      deduplicationId: job.id,
    });

    return job.id;
  }
}

// Singleton instance
export const frameGenerationService = new FrameGenerationService();
