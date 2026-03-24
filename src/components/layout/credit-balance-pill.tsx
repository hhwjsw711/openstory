/**
 * Credit Balance Pill
 * Shows the credit balance badge in the header. Visible when:
 * 1. Low balance with no safety net (amber warning)
 * 2. Balance topped up — stays until credits are drawn down (green)
 * 3. User toggled "always show" in credits page (neutral)
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useBalanceFlash } from '@/hooks/use-balance-flash';
import { useBillingBalance } from '@/hooks/use-billing-balance';
import { useBillingGateQuery } from '@/hooks/use-billing-gate';
import { useShowBalance } from '@/hooks/use-show-balance';
import { Link } from '@tanstack/react-router';

export const CreditBalancePill: React.FC = () => {
  const { balance, isLowBalance } = useBillingBalance();
  const { data: gateStatus } = useBillingGateQuery();
  const { showBalance } = useShowBalance();
  const { isFlashing } = useBalanceFlash();

  const hasSafetyNet =
    gateStatus?.hasAutoTopUp ||
    gateStatus?.hasFalKey ||
    gateStatus?.hasOpenRouterKey;

  const isLowBalanceVisible = isLowBalance && !hasSafetyNet;
  const isVisible = isLowBalanceVisible || showBalance || isFlashing;

  if (!isVisible) return null;

  // Flash (green) takes priority, then low-balance (amber), then neutral
  const colorClass = isFlashing
    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
    : isLowBalanceVisible
      ? 'border-amber-500 text-amber-600 dark:text-amber-400'
      : '';

  return (
    <Link to="/credits">
      <Badge
        variant="outline"
        className={cn(
          'tabular-nums cursor-pointer animate-[balance-flash-in_300ms_ease-out_both]',
          colorClass
        )}
      >
        ${balance?.toFixed(2) ?? '0.00'}
      </Badge>
    </Link>
  );
};
