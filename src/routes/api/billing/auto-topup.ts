/**
 * Auto Top-Up Settings API
 * POST /api/billing/auto-topup - Update auto top-up configuration
 */

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { isBillingEnabled } from '@/lib/billing/constants';
import { requireUser } from '@/lib/auth/action-utils';
import {
  getUserDefaultTeam,
  requireTeamManagement,
} from '@/lib/db/helpers/team-permissions';
import { handleApiError, ValidationError } from '@/lib/errors';
import {
  getBillingSettings,
  updateAutoTopUpSettings,
} from '@/lib/billing/credit-service';
import { usdToMicros } from '@/lib/billing/money';

export const Route = createFileRoute('/api/billing/auto-topup')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isBillingEnabled()) {
          return json(
            { success: false, error: { message: 'Billing is not enabled' } },
            { status: 404 }
          );
        }

        try {
          const user = await requireUser();
          const team = await getUserDefaultTeam(user.id);
          if (!team) throw new ValidationError('No team found');

          // Only admins/owners can change billing settings
          await requireTeamManagement(user.id, team.teamId);

          const billingSettings = await getBillingSettings(team.teamId);

          // Auto-top-up requires a saved payment method
          if (!billingSettings.stripeCustomerId) {
            throw new ValidationError(
              'Add a payment method first by making a top-up purchase'
            );
          }

          const body: {
            enabled?: boolean;
            thresholdUsd?: number;
            amountUsd?: number;
          } = await request.json();

          if (body.enabled === undefined) {
            throw new ValidationError('enabled field is required');
          }

          await updateAutoTopUpSettings(team.teamId, {
            enabled: body.enabled,
            thresholdMicros:
              body.thresholdUsd !== undefined
                ? usdToMicros(body.thresholdUsd)
                : undefined,
            amountMicros:
              body.amountUsd !== undefined
                ? usdToMicros(body.amountUsd)
                : undefined,
          });

          return json(
            {
              success: true,
              message: body.enabled
                ? 'Auto top-up enabled'
                : 'Auto top-up disabled',
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error('[POST /api/billing/auto-topup] Error:', error);
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
