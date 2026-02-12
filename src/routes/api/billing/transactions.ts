/**
 * Billing Transactions API
 * GET /api/billing/transactions - Get team transaction history
 */

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { requireUser } from '@/lib/auth/action-utils';
import { getUserDefaultTeam } from '@/lib/db/helpers/team-permissions';
import { handleApiError, ValidationError } from '@/lib/errors';
import { getTransactionHistory } from '@/lib/billing/credit-service';

export const Route = createFileRoute('/api/billing/transactions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUser();
          const team = await getUserDefaultTeam(user.id);
          if (!team) throw new ValidationError('No team found');

          const url = new URL(request.url);
          const limit = Math.min(
            parseInt(url.searchParams.get('limit') ?? '50', 10),
            100
          );
          const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

          const result = await getTransactionHistory(team.teamId, {
            limit,
            offset,
          });

          return json(
            {
              success: true,
              data: result,
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        } catch (error) {
          console.error('[GET /api/billing/transactions] Error:', error);
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
