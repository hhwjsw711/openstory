/**
 * Platform-agnostic API response utilities for TanStack Start
 * These work with the standard Web Response API
 */

type SuccessResponse<T> = {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
};

type ErrorResponse = {
  success: false;
  message: string;
  timestamp: string;
  error?: unknown;
  errors?: unknown;
  rateLimitInfo?: {
    isRateLimited: boolean;
    remainingTimeMs: number;
  };
};

/**
 * Create a JSON response with the standard Web Response API
 */
function json<T>(data: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): Response {
  const body: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  };
  return json(body, { status });
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  status: number = 400,
  extra?: Partial<Omit<ErrorResponse, 'success' | 'message' | 'timestamp'>>
): Response {
  const body: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  return json(body, { status });
}
