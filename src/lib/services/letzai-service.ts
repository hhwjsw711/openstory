/**
 * LetzAI service layer with comprehensive error handling and monitoring
 * Provides enterprise-grade integration with LetzAI API
 */

import { db } from '@/lib/db/client';
import { letzaiRequests } from '@/lib/db/schema/tracking';
import { VelroError } from '@/lib/errors';
import type {
  LetzAIEndpoint,
  LetzAIImageEditRequest,
  LetzAIImageEditResponse,
  LetzAIImageRequest,
  LetzAIImageResponse,
  LetzAIModelResponse,
  LetzAIServiceRequest,
  LetzAIUpscaleRequest,
} from '@/lib/schemas/letzai-request';
import { and, eq, gte, lte } from 'drizzle-orm';

// Configuration constants
const LETZAI_API_URL = 'https://api.letz.ai';
const POLL_INTERVAL_MS = 3000; // 3 seconds as recommended by LetzAI

// Service response interface
export interface LetzAIServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  latencyMs?: number;
  cost?: number;
  requestId?: string;
}

/**
 * Enhanced LetzAI service class with comprehensive error handling and monitoring
 */
export class LetzAIService {
  constructor() {
    const apiKey = process.env.LETZAI_API_KEY;
    if (!apiKey) {
      throw new VelroError(
        'LETZAI_API_KEY environment variable is required',
        'LETZAI_CONFIG_ERROR',
        500
      );
    }
    // API key is used in request headers
  }

  /**
   * Generate image using LetzAI with full service layer features
   */
  async generateImage(
    params: LetzAIImageRequest,
    options?: {
      userId?: string;
      teamId?: string;
      jobId?: string;
    }
  ): Promise<LetzAIServiceResponse<LetzAIImageResponse>> {
    const result = await this.executeRequest({
      endpoint: '/images',
      parameters: params,
      userId: options?.userId,
      teamId: options?.teamId,
      jobId: options?.jobId,
    });

    return result as LetzAIServiceResponse<LetzAIImageResponse>;
  }

  /**
   * Edit image using LetzAI with full service layer features
   */
  async editImage(
    params: LetzAIImageEditRequest,
    options?: {
      userId?: string;
      teamId?: string;
      jobId?: string;
    }
  ): Promise<LetzAIServiceResponse<LetzAIImageEditResponse>> {
    const result = await this.executeRequest({
      endpoint: '/image-edits',
      parameters: params,
      userId: options?.userId,
      teamId: options?.teamId,
      jobId: options?.jobId,
    });

    return result as LetzAIServiceResponse<LetzAIImageEditResponse>;
  }

  /**
   * Upscale image using LetzAI with full service layer features
   */
  async upscaleImage(
    params: LetzAIUpscaleRequest,
    options?: {
      userId?: string;
      teamId?: string;
      jobId?: string;
    }
  ): Promise<LetzAIServiceResponse<LetzAIImageResponse>> {
    const result = await this.executeRequest({
      endpoint: '/upscale',
      parameters: params,
      userId: options?.userId,
      teamId: options?.teamId,
      jobId: options?.jobId,
    });

    return result as LetzAIServiceResponse<LetzAIImageResponse>;
  }

  /**
   * Get available models from LetzAI
   */
  async getModels(params?: {
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'usages';
    sortOrder?: 'ASC' | 'DESC';
    class?: 'person' | 'object' | 'style';
  }): Promise<LetzAIServiceResponse<LetzAIModelResponse[]>> {
    const result = await this.executeRequest({
      endpoint: '/models',
      parameters: params || {},
    });

    return result as LetzAIServiceResponse<LetzAIModelResponse[]>;
  }

  /**
   * Check status of a LetzAI job
   */
  async checkStatus(
    jobId: string,
    endpoint: LetzAIEndpoint = '/images'
  ): Promise<LetzAIServiceResponse> {
    try {
      const response = await fetch(`${LETZAI_API_URL}${endpoint}/${jobId}`, {
        headers: {
          Authorization: `Bearer ${process.env.LETZAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('[LetzAI Service] Status check failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Status check failed',
      };
    }
  }

  /**
   * Get health status of LetzAI service
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    latencyMs?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Test with a simple models call to check if the service is healthy
      const response = await fetch(`${LETZAI_API_URL}/models?limit=1`, {
        headers: {
          Authorization: `Bearer ${process.env.LETZAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout for health check
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return { healthy: true, latencyMs };
      } else {
        return {
          healthy: false,
          latencyMs,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  /**
   * Get usage statistics for a team
   */
  async getUsageStats(params: {
    teamId: string;
    startDate?: Date;
    endDate?: Date;
    endpoint?: LetzAIEndpoint;
  }): Promise<{
    totalRequests: number;
    totalCost: number;
    averageLatency: number;
    successRate: number;
    requestsByEndpoint: Record<string, number>;
    costByEndpoint: Record<string, number>;
  }> {
    const { teamId, startDate, endDate, endpoint } = params;

    // Build where conditions
    const conditions = [eq(letzaiRequests.teamId, teamId)];
    if (startDate) conditions.push(gte(letzaiRequests.createdAt, startDate));
    if (endDate) conditions.push(lte(letzaiRequests.createdAt, endDate));
    if (endpoint) conditions.push(eq(letzaiRequests.endpoint, endpoint));

    const requests = await db
      .select({
        endpoint: letzaiRequests.endpoint,
        status: letzaiRequests.status,
        costCredits: letzaiRequests.costCredits,
        latencyMs: letzaiRequests.latencyMs,
      })
      .from(letzaiRequests)
      .where(and(...conditions));

    const totalRequests = requests.length;
    const completedRequests = requests.filter((r) => r.status === 'completed');
    const totalCost = requests.reduce(
      (sum, r) => sum + Number(r.costCredits || 0),
      0
    );
    const totalLatency = requests.reduce(
      (sum, r) => sum + (r.latencyMs || 0),
      0
    );
    const averageLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;
    const successRate =
      totalRequests > 0 ? completedRequests.length / totalRequests : 0;

    const requestsByEndpoint: Record<string, number> = {};
    const costByEndpoint: Record<string, number> = {};

    for (const request of requests) {
      const ep = request.endpoint;
      requestsByEndpoint[ep] = (requestsByEndpoint[ep] || 0) + 1;
      costByEndpoint[ep] =
        (costByEndpoint[ep] || 0) + Number(request.costCredits || 0);
    }

    return {
      totalRequests,
      totalCost,
      averageLatency,
      successRate,
      requestsByEndpoint,
      costByEndpoint,
    };
  }

  /**
   * Calculate cost for LetzAI request based on endpoint and parameters
   */
  calculateCost(
    endpoint: LetzAIEndpoint,
    parameters: Record<string, unknown>
  ): number {
    // LetzAI pricing (these would need to be updated based on actual pricing)
    const baseCosts = {
      '/images': 1.0, // 1 credit per image
      '/image-edits': 1.5, // 1.5 credits per edit
      '/upscale': 0.5, // 0.5 credits per upscale
      '/models': 0.0, // Free endpoint
    };

    let cost = baseCosts[endpoint] || 0;

    // Adjust cost based on parameters
    if (endpoint === '/images') {
      const quality = (parameters.quality as number) || 2;
      const creativity = (parameters.creativity as number) || 2;
      cost *= (quality + creativity) / 4; // Scale based on quality and creativity
    }

    if (endpoint === '/image-edits') {
      const completionsCount =
        (parameters.imageCompletionsCount as number) || 3;
      cost *= completionsCount;
    }

    if (endpoint === '/upscale') {
      const strength = (parameters.strength as number) || 1;
      cost *= strength;
    }

    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Execute a LetzAI request with full error handling and monitoring
   */
  private async executeRequest(
    request: LetzAIServiceRequest
  ): Promise<LetzAIServiceResponse> {
    const startTime = Date.now();

    // Calculate estimated cost
    const estimatedCost = this.calculateCost(
      request.endpoint,
      request.parameters
    );

    // Create database record
    const [dbRecord] = await db
      .insert(letzaiRequests)
      .values({
        jobId: request.jobId,
        teamId: request.teamId,
        userId: request.userId,
        endpoint: request.endpoint,
        requestPayload: request.parameters,
        status: 'pending',
        costCredits: estimatedCost,
      })
      .returning({ id: letzaiRequests.id });

    if (!dbRecord) {
      console.error('[LetzAI Service] Failed to create database record');
      return {
        success: false,
        error: 'Failed to initialize request tracking',
      };
    }

    try {
      // Execute the API request
      const result = await this.makeApiRequest(
        request.endpoint,
        request.parameters
      );

      const latencyMs = Date.now() - startTime;

      // Update database record with success
      await db
        .update(letzaiRequests)
        .set({
          status: 'completed',
          responseData: result as Record<string, unknown>,
          latencyMs: latencyMs,
          updatedAt: new Date(),
          completedAt: new Date(),
        })
        .where(eq(letzaiRequests.id, dbRecord.id));

      return {
        success: true,
        data: result,
        latencyMs,
        cost: estimatedCost,
        requestId: dbRecord.id,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Update database record with failure
      await db
        .update(letzaiRequests)
        .set({
          status: 'failed',
          error: errorMessage,
          latencyMs: latencyMs,
          updatedAt: new Date(),
        })
        .where(eq(letzaiRequests.id, dbRecord.id));

      console.error('[LetzAI Service] Request failed:', error);

      return {
        success: false,
        error: errorMessage,
        latencyMs,
        requestId: dbRecord.id,
      };
    }
  }

  /**
   * Make the actual API request to LetzAI
   */
  private async makeApiRequest(
    endpoint: LetzAIEndpoint,
    parameters: Record<string, unknown>
  ): Promise<unknown> {
    const response = await fetch(`${LETZAI_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.LETZAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parameters),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LetzAI API error: ${response.status} - ${errorText}`);
    }

    const result: { id: string; status: string } = await response.json();

    // For async endpoints, poll for completion
    if (result.id && result.status && result.status !== 'ready') {
      return await this.pollForCompletion(result.id, endpoint);
    }

    return result;
  }

  /**
   * Poll for request completion (for async endpoints)
   */
  private async pollForCompletion(
    jobId: string,
    endpoint: LetzAIEndpoint
  ): Promise<unknown> {
    const maxPolls = 120; // 6 minutes with 3-second intervals
    let polls = 0;

    while (polls < maxPolls) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      polls++;

      const statusResponse = await fetch(
        `${LETZAI_API_URL}${endpoint}/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.LETZAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!statusResponse.ok) {
        throw new Error(`LetzAI status check error: ${statusResponse.status}`);
      }

      const statusData: { id: string; status: string; error?: string } =
        await statusResponse.json();

      if (statusData.status === 'ready') {
        return statusData;
      }

      if (statusData.status === 'failed') {
        throw new Error(
          `LetzAI generation failed: ${statusData.error || 'Unknown error'}`
        );
      }
    }

    throw new Error('LetzAI generation timed out');
  }
}

/**
 * Get singleton instance of LetzAI service
 */
let letzaiServiceInstance: LetzAIService | null = null;

export function getLetzAIService(): LetzAIService {
  if (!letzaiServiceInstance) {
    letzaiServiceInstance = new LetzAIService();
  }
  return letzaiServiceInstance;
}
