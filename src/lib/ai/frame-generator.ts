/**
 * Frame generation service
 * Divides script into chunks for storyboard frames
 */

import type { Json } from "@/types/database";

export interface GenerateFrameDescriptionsParams {
  script: string;
  scriptAnalysis: {
    scenes: Array<{
      start: number;
      end: number;
      description: string;
      duration?: number;
    }>;
    characters?: string[];
    settings?: string[];
  };
  styleStack?: Json;
  framesPerScene?: number;
  aiProvider?: "openai" | "anthropic" | "openrouter";
}

export interface FrameDescriptionResult {
  frames: Array<{
    description: string; // This will be the script chunk
    orderIndex: number;
    durationMs: number;
    metadata: {
      scene: number;
      scriptChunk: string;
      scriptStart: number;
      scriptEnd: number;
      shotType?: string;
      characters?: string[];
      settings?: string[];
    };
  }>;
  totalDuration: number;
  frameCount: number;
}

/**
 * Generate frames by dividing script into chunks
 */
export async function generateFrameDescriptions(
  params: GenerateFrameDescriptionsParams,
): Promise<FrameDescriptionResult> {
  const { script, scriptAnalysis, framesPerScene = 5 } = params;

  console.log("[FrameGenerator] Generating frames from script chunks", {
    scenes: scriptAnalysis.scenes.length,
    framesPerScene,
  });

  const frames: FrameDescriptionResult["frames"] = [];
  let orderIndex = 0;
  let totalDuration = 0;

  // Process each scene
  for (
    let sceneIndex = 0;
    sceneIndex < scriptAnalysis.scenes.length;
    sceneIndex++
  ) {
    const scene = scriptAnalysis.scenes[sceneIndex];
    const sceneDuration = scene.duration || 5000; // Default 5 seconds per scene
    const frameDuration = sceneDuration / framesPerScene;

    // Calculate script chunks for each frame in the scene
    const scriptLength = scene.end - scene.start;
    const chunkSize = Math.ceil(scriptLength / framesPerScene);

    // Generate frames for this scene
    for (let frameIndex = 0; frameIndex < framesPerScene; frameIndex++) {
      // Calculate script chunk positions for this frame
      const frameScriptStart = scene.start + frameIndex * chunkSize;
      const frameScriptEnd = Math.min(frameScriptStart + chunkSize, scene.end);
      const frameScriptChunk = script.slice(frameScriptStart, frameScriptEnd);

      // Define basic shot types that cycle through frames
      const shotTypes = [
        "wide shot",
        "medium shot",
        "close-up",
        "medium shot",
        "wide shot",
      ];
      const shotType = shotTypes[frameIndex % shotTypes.length];

      frames.push({
        description: frameScriptChunk, // Use script chunk as description
        orderIndex: orderIndex++,
        durationMs: Math.round(frameDuration),
        metadata: {
          scene: sceneIndex,
          scriptChunk: frameScriptChunk,
          scriptStart: frameScriptStart,
          scriptEnd: frameScriptEnd,
          shotType,
          characters: scriptAnalysis.characters?.slice(0, 2),
          settings: scriptAnalysis.settings?.slice(0, 1),
        },
      });

      totalDuration += frameDuration;
    }
  }

  return {
    frames,
    totalDuration,
    frameCount: frames.length,
  };
}
