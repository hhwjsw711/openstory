"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/app/actions/user";
import {
  createServerClient,
  createSessionAwareClient,
} from "@/lib/supabase/server";
import type { Frame, Sequence, SequenceInsert } from "@/types/database";

// Schema definitions
const createSequenceSchema = z.object({
  name: z.string().min(1).max(100),
  script: z.string().min(10).max(10000),
  style_id: z.uuid().optional(),
});

const updateSequenceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100).optional(),
  script: z.string().min(10).max(10000).optional(),
  style_id: z.uuid().nullable().optional(),
});

export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;
export type UpdateSequenceInput = z.infer<typeof updateSequenceSchema>;

/**
 * Create or update a sequence in the database
 */
export async function saveSequence(
  script: string,
  styleId: string | null,
  sequenceId?: string,
  name?: string,
): Promise<{ success: boolean; sequence?: Sequence; error?: string }> {
  try {
    // Ensure we have a user (create anonymous if needed)
    const userResult = await getCurrentUser();
    if (!userResult.success || !userResult.data) {
      throw new Error(userResult.error || "Failed to get user");
    }

    const supabase = await createSessionAwareClient();

    let sequence: Sequence | null = null;

    if (sequenceId) {
      // Update existing sequence
      const { data, error } = await supabase
        .from("sequences")
        .update({
          script,
          style_id: styleId,
          title: name || "Untitled Sequence",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sequenceId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      sequence = data;
    } else {
      // Create new sequence - get team_id for current user
      // Since we ensured a user exists above, they should have a team
      const { data: teamMembership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userResult.data.user.id)
        .eq("role", "owner")
        .single();

      if (!teamMembership) {
        throw new Error(
          "No team found for user. Please refresh the page to initialize your account.",
        );
      }

      const teamId = teamMembership.team_id;

      const sequenceData: SequenceInsert = {
        script,
        style_id: styleId,
        title: name || "Untitled Sequence",
        team_id: teamId,
        status: "draft",
      };

      const { data, error } = await supabase
        .from("sequences")
        .insert(sequenceData)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      sequence = data;
    }

    // The script and / or style may have changed, so we need to regenerate the frames
    await generateFrames(sequence.id);

    return {
      success: true,
      sequence,
    };
  } catch (error) {
    console.error("Error saving sequence:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save sequence",
    };
  }
}

/**
 * Generate frames from script and save to database using AI
 */
export async function generateFrames(sequenceId: string): Promise<{
  success: boolean;
  frames?: Frame[];
  jobId?: string;
  error?: string;
}> {
  try {
    // Import the AI-powered frame generation action
    const { generateFramesAction } = await import("#actions/frames");

    // Call the simplified frame generation action - it will load everything from the database
    const result = await generateFramesAction({
      sequenceId,
      options: {
        framesPerScene: 3, // Generate 3 frames per scene
        generateThumbnails: true,
        generateDescriptions: true,
        aiProvider: "openrouter", // Use OpenRouter for AI generation
        regenerateAll: true, // Delete existing frames before generating new ones
      },
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to generate frames");
    }

    // Return success with job ID for tracking
    return {
      success: true,
      jobId: result.jobId,
      frames: [], // Frames will be populated asynchronously via QStash
    };
  } catch (error) {
    console.error("Error generating frames:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate frames",
    };
  }
}

/**
 * Generate motion for a frame and update in database
 */
export async function generateFrameMotion(
  frameId: string,
  frameDescription: string,
  styleId: string,
): Promise<{
  success: boolean;
  videoUrl?: string;
  duration?: number;
  error?: string;
}> {
  try {
    const supabase = createServerClient();

    // Use mock function to generate video URL
    // In production, this would call an AI video service
    const { generateFrameMotion: generateMockMotion } = await import(
      "#actions/anonymous-flow"
    );
    const mockResult = await generateMockMotion(
      frameId,
      frameDescription,
      styleId,
    );

    if (!mockResult.success) {
      throw new Error(mockResult.error || "Failed to generate motion");
    }

    // Update frame with video URL
    const { data, error } = await supabase
      .from("frames")
      .update({
        video_url: mockResult.videoUrl,
        metadata: {
          motionGenerated: true,
          motionDuration: mockResult.duration,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", frameId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/sequences/${data.sequence_id}`);
    return {
      success: true,
      videoUrl: mockResult.videoUrl,
      duration: mockResult.duration,
    };
  } catch (error) {
    console.error("Error generating motion:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate motion",
    };
  }
}

/**
 * Get a sequence by ID with all its frames
 */
export async function getSequence(sequenceId: string): Promise<{
  success: boolean;
  sequence?: Sequence & { frames: Frame[] };
  error?: string;
}> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("sequences")
      .select(`
        *,
        frames (*)
      `)
      .eq("id", sequenceId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      sequence: data,
    };
  } catch (error) {
    console.error("Error getting sequence:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get sequence",
    };
  }
}

// Legacy functions for backward compatibility with existing schema
export async function createSequence(input: CreateSequenceInput) {
  const validated = createSequenceSchema.parse(input);
  return saveSequence(
    validated.script,
    validated.style_id || null,
    undefined,
    validated.name,
  );
}

export async function updateSequence(input: UpdateSequenceInput) {
  const validated = updateSequenceSchema.parse(input);
  return saveSequence(
    validated.script || "",
    validated.style_id === undefined ? null : validated.style_id,
    validated.id,
    validated.name,
  );
}

export async function deleteSequence(_id: string) {
  throw new Error("Not implemented - use mock in Storybook");
}

export async function listSequences(_teamId?: string) {
  throw new Error("Not implemented - use mock in Storybook");
}

export async function generateStoryboard(sequenceId: string) {
  const sequenceResult = await getSequence(sequenceId);
  if (!sequenceResult.success || !sequenceResult.sequence) {
    throw new Error("Sequence not found");
  }

  const { script, style_id } = sequenceResult.sequence;
  if (!script || !style_id) {
    throw new Error("Sequence missing script or style");
  }

  return generateFrames(sequenceId);
}
