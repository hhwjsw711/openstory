import { createFileRoute } from '@tanstack/react-router';
import { getRealtime } from '@/lib/realtime';
import { handle } from '@upstash/realtime';
import { authRequestMiddleware } from '@/functions/middleware';

export const Route = createFileRoute('/api/realtime')({
  server: {
    middleware: [authRequestMiddleware],
    handlers: {
      GET: async ({ request }) => {
        const realtime = getRealtime();
        const response = await handle({ realtime })(request);
        if (!response) {
          throw new Error('Failed to get realtime');
        }
        return response;
      },
    },
  },
});
