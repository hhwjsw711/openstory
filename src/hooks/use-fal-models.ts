import { useMutation, useQuery } from "@tanstack/react-query";
import z from "zod";
import type { FalModelsRequest } from "@/lib/schemas/fal-request";

// Validation schemas for response
const falModelsResponseSchema = z.object({
  models: z.array(
    z.object({
      id: z.string(),
      model: z.string(),
      name: z.string(),
      type: z.enum(["image", "video"]),
    }),
  ),
});

const estimateImageCostByFalResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    cost: z.number(),
    time: z.number(),
  }),
});

// Query keys
export const falModelKeys = {
  all: ["fal-models"] as const,
  lists: () => [...falModelKeys.all, "list"] as const,
  estimate: () => [...falModelKeys.all, "estimate"] as const,
};

// Fetch all FAL models function
async function fetchFalModels(params: FalModelsRequest) {
  const url = new URL("/api/fal/models", window.location.origin);
  url.searchParams.set("type", params.type);
  if (typeof params.includeCosts === "boolean") {
    url.searchParams.set("includeCosts", String(params.includeCosts));
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      "[hooks/use-fal-models/fetchFalModels] Failed to fetch FAL models",
    );
  }
  const data = await response.json();
  return falModelsResponseSchema.parse(data);
}

// Hook for listing FAL models
export function useFalModels(params: FalModelsRequest) {
  return useQuery({
    queryKey: [...falModelKeys.lists(), params.type, params.includeCosts],
    queryFn: () => fetchFalModels(params),
  });
}

// fetch estimate image cost by FAL
async function fetchEstimateImageCostByFal(
  params: EstimateImageCostByFalRequest,
) {
  const url = new URL("/api/fal/estimates", window.location.origin);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(
      "[hooks/use-fal-models/fetchEstimateImageCostByFal] Failed to fetch estimate",
    );
  }
  const data = await response.json();
  return estimateImageCostByFalResponseSchema.parse(data);
}

// hook for estimating image cost by FAL
export interface EstimateImageCostByFalRequest {
  model: string;
  prompt: string;
  extra_params: Record<string, unknown>;
}

// Hook for estimating image cost by FAL
export function useEstimateImageCostByFal() {
  return useMutation<
    { success: boolean; data: { cost: number; time: number } },
    Error,
    EstimateImageCostByFalRequest
  >({
    mutationFn: (params: EstimateImageCostByFalRequest) =>
      fetchEstimateImageCostByFal(params),
  });
}
