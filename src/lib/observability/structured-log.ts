/**
 * Structured JSON log emitter for Cloudflare Workers.
 * Outputs JSON to console.log so Cloudflare captures it in workers_trace_events,
 * and Logpush sends it unredacted to R2.
 */

type StructuredLog = {
  level: 'info' | 'warn' | 'error';
  source: 'serverFn' | 'api' | 'workflow';
  name: string;
  method?: string;
  path?: string;
  durationMs: number;
  contentLength?: number;
  userId?: string;
  status: 'ok' | 'error';
  error?: {
    code: string;
    message: string;
    statusCode?: number;
  };
};

const REDACT = '[REDACTED]';

const SECRET_PATTERNS = [
  // API keys / tokens (common prefixes and generic patterns)
  /\b(sk|pk|fal|key|token|secret|password|bearer)[-_]?[a-zA-Z0-9\-_.]{16,}\b/gi,
  // Connection strings (postgres, mysql, redis, libsql, etc.)
  /\b(postgres|mysql|redis|libsql|https?):\/\/[^\s"']+@[^\s"']+/gi,
  // Base64 blobs (>64 chars likely a credential or payload, not useful in logs)
  /\b[A-Za-z0-9+/]{64,}={0,2}\b/g,
  // AWS-style keys
  /\bAKIA[A-Z0-9]{16}\b/g,
  // Cloudflare API tokens
  /\b[A-Za-z0-9_-]{40}\b(?=.*(?:token|key|secret))/gi,
];

function redactSecrets(message: string): string {
  let result = message;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, REDACT);
  }
  return result;
}

export function emitLog(log: StructuredLog): void {
  if (log.error?.message) {
    log = {
      ...log,
      error: {
        ...log.error,
        message: redactSecrets(log.error.message),
      },
    };
  }
  console.log(JSON.stringify(log));
}
