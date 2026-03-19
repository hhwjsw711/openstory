/**
 * Structured logging wrapper for API route handlers.
 * Wraps a handler to emit structured JSON logs with timing, status, and error details.
 */

import { handleApiError } from '@/lib/errors';
import { emitLog } from './structured-log';

type ApiHandlerArgs = {
  request: Request;
  params: Record<string, string>;
};

export function withApiLogging(
  routeName: string,
  handler: (args: ApiHandlerArgs) => Promise<Response>
): (args: ApiHandlerArgs) => Promise<Response> {
  return async (args) => {
    const start = performance.now();
    const { request } = args;
    const contentLength = request.headers.get('content-length');
    const path = new URL(request.url).pathname;

    try {
      const response = await handler(args);
      const durationMs = Math.round(performance.now() - start);
      const isError = response.status >= 400;

      emitLog({
        level: isError ? 'error' : 'info',
        source: 'api',
        name: routeName,
        method: request.method,
        path,
        durationMs,
        contentLength: contentLength ? Number(contentLength) : undefined,
        status: isError ? 'error' : 'ok',
      });

      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      const handled = handleApiError(error);

      emitLog({
        level: 'error',
        source: 'api',
        name: routeName,
        method: request.method,
        path,
        durationMs,
        contentLength: contentLength ? Number(contentLength) : undefined,
        status: 'error',
        error: {
          code: handled.code,
          message: handled.message,
          statusCode: handled.statusCode,
        },
      });

      throw error;
    }
  };
}
