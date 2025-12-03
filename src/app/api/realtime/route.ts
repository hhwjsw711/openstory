// src/app/api/realtime/route.ts
import { getRealtime } from '@/lib/realtime';
import { handle } from '@upstash/realtime';
import { NextRequest } from 'next/server';

// Explicitly set nodejs runtime for SSE streaming support
export const runtime = 'nodejs';

export const GET = async (req: NextRequest) => {
  const realtime = getRealtime();
  const response = await handle({ realtime })(req);

  // Ensure proper headers for Cloudflare Workers SSE
  const headers = new Headers(response?.headers);
  headers.set('Cache-Control', 'no-cache');
  headers.set('Connection', 'keep-alive');

  return new Response(response?.body, {
    status: response?.status,
    statusText: response?.statusText,
    headers,
  });
};
