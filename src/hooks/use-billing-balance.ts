/**
 * Shared billing balance hook
 * Provides balance data, low-balance detection, and query key for invalidation
 */

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/client';
import { LOW_BALANCE_THRESHOLD_USD } from '@/lib/billing/constants';

export const BILLING_BALANCE_KEY = ['billing-balance'] as const;

type BalanceData = {
  balance: number;
  autoTopUp: {
    enabled: boolean;
    thresholdUsd: number | null;
    amountUsd: number | null;
  };
  hasPaymentMethod: boolean;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

async function fetchBalance(): Promise<BalanceData> {
  const res = await fetch('/api/billing/balance');
  const json: ApiResponse<BalanceData> = await res.json();
  if (!json.success || !json.data)
    throw new Error(json.error?.message ?? 'Failed to fetch balance');
  return json.data;
}

export function useBillingBalance() {
  const { data: session } = useSession();

  const query = useQuery({
    queryKey: [...BILLING_BALANCE_KEY],
    queryFn: fetchBalance,
    staleTime: 30_000,
    enabled: !!session,
  });

  const balance = query.data?.balance ?? null;
  const autoTopUp = query.data?.autoTopUp;
  const lowBalanceThreshold =
    autoTopUp?.enabled && autoTopUp.thresholdUsd != null
      ? autoTopUp.thresholdUsd
      : LOW_BALANCE_THRESHOLD_USD;

  return {
    ...query,
    balance,
    isLowBalance:
      balance !== null && balance > 0 && balance <= lowBalanceThreshold,
    isZeroBalance: balance !== null && balance <= 0,
    lowBalanceThreshold,
  };
}
