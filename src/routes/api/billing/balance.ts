/**
 * Billing Balance API
 * GET /api/billing/balance - Get team credit balance and billing settings
 */

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { isStripeEnabled } from '@/lib/billing/constants';
import { requireUser } from '@/lib/auth/action-utils';
import { resolveUserTeam } from '@/lib/db/scoped';
import { handleApiError } from '@/lib/errors';
import { createScopedDb } from '@/lib/db/scoped';
import { micros, microsToUsd } from '@/lib/billing/money';

export const Route = createFileRoute('/api/billing/balance')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const user = await requireUser();
          const team = await resolveUserTeam(user.id);
          if (!team) {
            return json({
              success: true,
              data: {
                balance: 0,
                stripeEnabled: isStripeEnabled(),
                autoTopUp: {
                  enabled: false,
                  thresholdUsd: null,
                  amountUsd: null,
                },
                hasPaymentMethod: false,
              },
              timestamp: new Date().toISOString(),
            });
          }

          const scopedDb = createScopedDb(team.teamId);
          const [balance, settings] = await Promise.all([
            scopedDb.billing.getBalance(),
            scopedDb.billing.getBillingSettings(),
          ]);

          return json(
            {
              success: true,
              data: {
                balance: microsToUsd(balance),
                stripeEnabled: isStripeEnabled(),
                autoTopUp: {
                  enabled: settings.autoTopUpEnabled,
                  thresholdUsd: settings.autoTopUpThresholdMicros
                    ? microsToUsd(micros(settings.autoTopUpThresholdMicros))
                    : null,
                  amountUsd: settings.autoTopUpAmountMicros
                    ? microsToUsd(micros(settings.autoTopUpAmountMicros))
                    : null,
                },
                hasPaymentMethod: !!settings.stripeCustomerId,
              },
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error('[GET /api/billing/balance] Error:', error);
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
