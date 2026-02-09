/**
 * Credit Balance Pill
 * Shows current credit balance in the header with color-coded status
 */

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBillingBalance } from '@/hooks/use-billing-balance';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

export const CreditBalancePill: React.FC = () => {
  const { balance, isLowBalance, isZeroBalance, isLoading, data } =
    useBillingBalance();

  // Don't render if user is not authenticated (no data)
  if (!isLoading && !data) return null;

  if (isLoading) {
    return <Skeleton className="h-6 w-16 rounded-md" />;
  }

  const variant = isZeroBalance
    ? 'destructive'
    : isLowBalance
      ? 'outline'
      : 'secondary';

  return (
    <Link to="/settings/billing">
      <Badge
        variant={variant}
        className={cn(
          'tabular-nums cursor-pointer',
          isLowBalance &&
            !isZeroBalance &&
            'border-amber-500 text-amber-600 dark:text-amber-400'
        )}
      >
        ${balance?.toFixed(2) ?? '0.00'}
      </Badge>
    </Link>
  );
};
