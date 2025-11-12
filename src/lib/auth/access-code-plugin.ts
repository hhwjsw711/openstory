/**
 * Better Auth plugin for access code validation
 * Validates access codes during signup and stores them on user records
 */

import type { BetterAuthPlugin } from 'better-auth';
import { eq } from 'drizzle-orm';
import { isValidAccessCode } from './access-codes';

export const accessCodePlugin = (): BetterAuthPlugin => {
  return {
    id: 'access-code',
    hooks: {
      before: [
        {
          // Intercept signup requests to validate access code
          matcher: (context) => {
            return (
              context.path === '/sign-up/email' && context.method === 'POST'
            );
          },
          handler: async (context) => {
            // Get body and cast to unknown first for type safety
            const body = (await context.body) as unknown as
              | Record<string, unknown>
              | undefined;

            // Extract access code from request body
            const accessCode = body?.accessCode as string | undefined;

            // Validate access code
            if (!accessCode || !isValidAccessCode(accessCode)) {
              throw new Error(
                'Valid access code required. Please enter a valid access code to sign up.'
              );
            }

            // Normalize the code
            if (body) {
              body.accessCode = accessCode.toUpperCase().trim();
            }

            return context;
          },
        },
      ],
      after: [
        {
          // After successful signup, store the access code on the user
          matcher: (context) => {
            return (
              context.path === '/sign-up/email' && context.method === 'POST'
            );
          },
          handler: async (context) => {
            // Get body and cast to unknown first for type safety
            const body = (await context.body) as unknown as
              | Record<string, unknown>
              | undefined;
            const accessCode = body?.accessCode as string | undefined;

            // Get user ID from the context response
            const contextAny = context as Record<string, unknown>;
            const returned = contextAny.returned as
              | { user?: { id?: string } }
              | undefined;
            const userId = returned?.user?.id;

            if (accessCode && userId) {
              // Import db and user schema dynamically to avoid circular deps
              const { db } = await import('@/lib/db/client');
              const { user } = await import('@/lib/db/schema');

              // Update user with access code
              await db
                .update(user)
                .set({ accessCode })
                .where(eq(user.id, userId));

              console.log('[AccessCode] Stored access code for user', {
                userId,
                accessCode,
              });
            }

            return context;
          },
        },
      ],
    },
  };
};
