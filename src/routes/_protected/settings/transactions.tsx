/**
 * Transactions Settings Page
 * Full transaction history across all types
 */

import { createFileRoute } from '@tanstack/react-router';
import { TransactionSettings } from '@/components/settings/transaction-settings';

export const Route = createFileRoute('/_protected/settings/transactions')({
  component: TransactionSettings,
});
