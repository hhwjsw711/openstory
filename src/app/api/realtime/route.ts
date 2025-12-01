import { getRealtime } from '@/lib/realtime';
import { handle } from '@upstash/realtime';
import { NextRequest } from 'next/server';

// Using nodejs runtime as edge has issues with Turbopack SSE streaming

export const GET = async (req: NextRequest) => {
  const realtime = getRealtime();
  const response = await handle({ realtime })(req);

  return response;
};
