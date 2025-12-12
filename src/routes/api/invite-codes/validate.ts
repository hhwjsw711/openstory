import { createFileRoute } from '@tanstack/react-router';
import { isValidAccessCode } from '@/lib/auth/access-codes';

export const Route = createFileRoute('/api/invite-codes/validate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body: { code: string } = await request.json();
          const { code } = body;

          if (!code) {
            return Response.json(
              { isValid: false, message: 'Invite code is required' },
              { status: 400 }
            );
          }

          const isValid = isValidAccessCode(code);

          if (!isValid) {
            return Response.json({
              isValid: false,
              message: 'Invalid invite code',
            });
          }

          return Response.json({
            isValid: true,
            message: 'Valid invite code',
          });
        } catch (error) {
          console.error('Invite code validation error:', error);
          return Response.json(
            { isValid: false, message: 'Validation failed' },
            { status: 500 }
          );
        }
      },
    },
  },
});
