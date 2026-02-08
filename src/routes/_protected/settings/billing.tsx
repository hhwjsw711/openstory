/**
 * Billing Settings Page
 * Credit balance, top-up, auto-top-up, and transaction history
 */

import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { BillingSettings } from '@/components/settings/billing-settings';

const searchSchema = z.object({
  success: z.boolean().optional(),
  canceled: z.boolean().optional(),
});

export const Route = createFileRoute('/_protected/settings/billing')({
  validateSearch: searchSchema,
  component: BillingPage,
});

function BillingPage() {
  const { success, canceled } = Route.useSearch();
  return <BillingSettings success={success} canceled={canceled} />;
}
