/**
 * Billing Balance API
 * GET /api/billing/balance - Get team credit balance and billing settings
 */

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { isBillingEnabled } from '@/lib/billing/constants';
import { requireUser } from '@/lib/auth/action-utils';
import { getUserDefaultTeam } from '@/lib/db/helpers/team-permissions';
import { handleApiError, ValidationError } from '@/lib/errors';
import {
  getTeamBalance,
  getBillingSettings,
} from '@/lib/billing/credit-service';
import { micros, microsToUsd } from '@/lib/billing/money';

export const Route = createFileRoute('/api/billing/balance')({
  server: {
    handlers: {
      GET: async () => {
        if (!isBillingEnabled()) {
          return json({
            success: true,
            data: {
              billingEnabled: false,
              balance: 0,
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

        try {
          const user = await requireUser();
          const team = await getUserDefaultTeam(user.id);
          if (!team) throw new ValidationError('No team found');

          const [balance, settings] = await Promise.all([
            getTeamBalance(team.teamId),
            getBillingSettings(team.teamId),
          ]);

          return json(
            {
              success: true,
              data: {
                balance: microsToUsd(balance),
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
