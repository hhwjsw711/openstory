// src/routes/api/realtime.ts
import { createFileRoute } from '@tanstack/react-router';
import { getRealtime } from '@/lib/realtime';
import { handle } from '@upstash/realtime';

export const Route = createFileRoute('/api/realtime')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const realtime = getRealtime();
        const response = await handle({ realtime })(request);

        // Ensure proper headers for SSE streaming support
        const headers = new Headers(response?.headers);
        headers.set('Cache-Control', 'no-cache');
        headers.set('Connection', 'keep-alive');

        return new Response(response?.body, {
          status: response?.status,
          statusText: response?.statusText,
          headers,
        });
      },
    },
  },
});
