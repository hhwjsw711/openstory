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
import { micros, microsToUsd } from '@/lib/billing/money';
import type { TransactionType } from '@/lib/db/schema/credits';

const VALID_TRANSACTION_TYPES: readonly TransactionType[] = [
  'credit_purchase',
  'credit_usage',
  'credit_adjustment',
  'credit_refund',
];

function isTransactionType(value: string): value is TransactionType {
  return (VALID_TRANSACTION_TYPES as readonly string[]).includes(value);
}

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
          const rawType = url.searchParams.get('type');
          const type = rawType && isTransactionType(rawType) ? rawType : null;

          const result = await getTransactionHistory(team.teamId, {
            limit,
            offset,
            ...(type && { type }),
          });

          // Convert microdollar amounts to USD for frontend display
          const txsUsd = result.transactions.map((tx) => ({
            ...tx,
            amount: microsToUsd(micros(tx.amount)),
            balanceAfter: microsToUsd(micros(tx.balanceAfter)),
          }));

          return json(
            {
              success: true,
              data: { transactions: txsUsd, total: result.total },
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
