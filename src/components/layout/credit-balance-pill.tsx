/**
 * Credit Balance Pill
 * Shows as an amber warning when balance is low and user has no safety net
 * (no auto top-up and no BYOK API keys configured)
 */

import { Badge } from '@/components/ui/badge';
import { useBillingBalance } from '@/hooks/use-billing-balance';
import { useBillingGateQuery } from '@/hooks/use-billing-gate';
import { Link } from '@tanstack/react-router';

export const CreditBalancePill: React.FC = () => {
  const { balance, isLowBalance } = useBillingBalance();
  const { data: gateStatus } = useBillingGateQuery();

  // Only show when low balance AND no safety net configured
  const hasSafetyNet =
    gateStatus?.hasAutoTopUp ||
    gateStatus?.hasFalKey ||
    gateStatus?.hasOpenRouterKey;

  if (!isLowBalance || hasSafetyNet) return null;

  return (
    <Link to="/credits">
      <Badge
        variant="outline"
        className="tabular-nums cursor-pointer border-amber-500 text-amber-600 dark:text-amber-400"
      >
        ${balance?.toFixed(2) ?? '0.00'}
      </Badge>
    </Link>
  );
};
