/**
 * Fal.ai models endpoint
 * GET /api/v1/fal/models - List available Fal.ai models with metadata
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/errors";
import { getFalService } from "@/lib/fal/service";

// Query parameters schema
const modelsQuerySchema = z.object({
  type: z.enum(["image", "video", "all"]).optional().default("all"),
  includeCosts: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val === "true")
    .default(false),
});

// Model response types
interface ModelInfo {
  id: string;
  name: string;
  model: string;
  type: "image" | "video";
  cost?: number;
  costUnit?: string;
}

interface ModelsResponse {
  image?: ModelInfo[];
  video?: ModelInfo[];
}

/**
 * GET handler for available models
 */
export async function GET(request: Request) {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = {
      type: url.searchParams.get("type"),
      includeCosts: url.searchParams.get("includeCosts"),
    };

    const { type, includeCosts } = modelsQuerySchema.parse(queryParams);

    // Get Fal service instance
    const falService = getFalService();

    // Get available models
    const availableModels = falService.getAvailableModels();

    // Prepare response based on type filter
    let models: ModelsResponse | ModelInfo[] = {};

    if (type === "all" || type === "image") {
      models.image = Object.entries(availableModels.image).map(
        ([key, model]) => ({
          id: key,
          name: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          model: model,
          type: "image",
          ...(includeCosts && {
            cost: falService.calculateCost(model, {}),
            costUnit: "USD",
          }),
        }),
      );
    }

    if (type === "all" || type === "video") {
      models.video = Object.entries(availableModels.video).map(
        ([key, model]) => ({
          id: key,
          name: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          model: model,
          type: "video",
          ...(includeCosts && {
            cost: falService.calculateCost(model, {}),
            costUnit: "USD",
          }),
        }),
      );
    }

    // If specific type requested, flatten the response
    if (type !== "all") {
      models = models[type] || [];
    }

    // Calculate total count with proper type checking
    let totalCount = 0;
    if (type === "all" && !Array.isArray(models)) {
      totalCount = (models.image?.length || 0) + (models.video?.length || 0);
    } else if (Array.isArray(models)) {
      totalCount = models.length;
    } else {
      totalCount = Object.keys(models).length;
    }

    const response = {
      success: true,
      models,
      totalCount,
      timestamp: new Date().toISOString(),
      metadata: {
        filterType: type,
        includeCosts,
        supportedTypes: ["image", "video"],
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Fal Models] Failed to fetch models:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch available models",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
