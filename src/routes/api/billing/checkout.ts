/**
 * Billing Checkout API
 * POST /api/billing/checkout - Create a Stripe Checkout session for credit top-up
 */

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { isStripeEnabled } from '@/lib/billing/constants';
import { requireUser } from '@/lib/auth/action-utils';
import { resolveUserTeam } from '@/lib/db/scoped';
import { handleApiError, ValidationError } from '@/lib/errors';
import { createCheckoutSession } from '@/lib/billing/checkout';
import { getServerAppUrl } from '@/lib/utils/environment';

export const Route = createFileRoute('/api/billing/checkout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isStripeEnabled()) {
          return json(
            { success: false, error: { message: 'Stripe is not configured' } },
            { status: 404 }
          );
        }

        try {
          const user = await requireUser();
          const team = await resolveUserTeam(user.id);
          if (!team) throw new ValidationError('No team found');

          const body: { amountUsd?: number } = await request.json();
          const amountUsd = body.amountUsd;

          if (!amountUsd || typeof amountUsd !== 'number' || amountUsd <= 0) {
            throw new ValidationError('Invalid amount');
          }

          const req = getRequest();
          const appUrl = getServerAppUrl(req);

          const { url } = await createCheckoutSession({
            teamId: team.teamId,
            amountUsd,
            userId: user.id,
            userEmail: user.email,
            successUrl: `${appUrl}/credits?success=true`,
            cancelUrl: `${appUrl}/credits?canceled=true`,
          });

          return json(
            {
              success: true,
              data: { url },
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error('[POST /api/billing/checkout] Error:', error);
          const handledError = handleApiError(error);
          return json(
            {
              success: false,
              error: handledError.toJSON(),
              timestamp: new Date().toISOString(),
            },
            { status: handledError.statusCode }
          );
        }
      },
    },
  },
});
