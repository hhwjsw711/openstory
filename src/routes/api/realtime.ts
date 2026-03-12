import { createFileRoute } from '@tanstack/react-router';
import { getRealtime } from '@/lib/realtime';
import { handle } from '@upstash/realtime';
import { getAuth } from '@/lib/auth/config';

export const Route = createFileRoute('/api/realtime')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Validate session before allowing WebSocket connection
        const auth = getAuth();
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response('Unauthorized', { status: 401 });
        }

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
