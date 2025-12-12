import { getAuth } from '@/lib/auth/config';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = getAuth();
        return auth.handler(request);
      },
      POST: async ({ request }) => {
        const auth = getAuth();
        return auth.handler(request);
      },
    },
  },
});
