/**
 * Billing Gate Hook
 * Combines balance + BYOK status to gate credit-consuming actions
 */

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/client';
import { getBillingGateStatusFn } from '@/functions/billing-gate';
import { useState, useCallback } from 'react';

export const BILLING_GATE_KEY = ['billing-gate-byok'] as const;

type BillingGateStatus = {
  hasCredits: boolean;
  hasFalKey: boolean;
  hasOpenRouterKey: boolean;
  balance: number;
  hasAutoTopUp: boolean;
};

export function useBillingGateQuery() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: [...BILLING_GATE_KEY],
    queryFn: () => getBillingGateStatusFn(),
    staleTime: 60_000,
    enabled: !!session,
  });
}

/**
 * Gate for sequence creation (needs both OpenRouter + fal.ai)
 */
export function useBillingGate() {
  const query = useBillingGateQuery();
  const [open, setOpen] = useState(false);

  const data: BillingGateStatus | undefined = query.data;

  const canGenerate = data
    ? data.hasCredits ||
      (data.hasFalKey && data.hasOpenRouterKey) ||
      data.hasAutoTopUp
    : true; // Don't block while loading

  const needsBillingSetup = data
    ? !data.hasCredits &&
      !(data.hasFalKey && data.hasOpenRouterKey) &&
      !data.hasAutoTopUp
    : false;

  const showGate = useCallback(() => setOpen(true), []);

  return {
    canGenerate,
    needsBillingSetup,
    hasFalKey: data?.hasFalKey ?? false,
    hasOpenRouterKey: data?.hasOpenRouterKey ?? false,
    hasCredits: data?.hasCredits ?? true,
    hasAutoTopUp: data?.hasAutoTopUp ?? false,
    showGate,
    gateProps: { open, onOpenChange: setOpen },
    isLoading: query.isLoading,
  };
}

/**
 * Gate for image/motion generation (only needs fal.ai)
 */
export function useFalBillingGate() {
  const query = useBillingGateQuery();
  const [open, setOpen] = useState(false);

  const data: BillingGateStatus | undefined = query.data;

  const canGenerate = data
    ? data.hasCredits || data.hasFalKey || data.hasAutoTopUp
    : true;

  const needsBillingSetup = data
    ? !data.hasCredits && !data.hasFalKey && !data.hasAutoTopUp
    : false;

  const showGate = useCallback(() => setOpen(true), []);

  return {
    canGenerate,
    needsBillingSetup,
    hasFalKey: data?.hasFalKey ?? false,
    hasCredits: data?.hasCredits ?? true,
    hasAutoTopUp: data?.hasAutoTopUp ?? false,
    showGate,
    gateProps: { open, onOpenChange: setOpen },
    isLoading: query.isLoading,
  };
}
