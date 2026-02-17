/**
 * Billing Settings Component
 * Credit balance, top-up buttons, auto-top-up config, transaction history
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PRESET_TOPUP_AMOUNTS_USD,
  MIN_TOPUP_AMOUNT_USD,
} from '@/lib/billing/constants';
import {
  useBillingBalance,
  BILLING_BALANCE_KEY,
} from '@/hooks/use-billing-balance';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  DollarSign,
  ExternalLink,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type BillingSettingsProps = {
  success?: boolean;
  canceled?: boolean;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

type TransactionData = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  metadata?: { receiptUrl?: string } | null;
  createdAt: string;
};

type TransactionApiResponse = {
  success: boolean;
  data?: { transactions: TransactionData[]; total: number };
  error?: { message?: string };
};

async function fetchTransactions(): Promise<{
  transactions: TransactionData[];
  total: number;
}> {
  const res = await fetch('/api/billing/transactions?limit=20');
  const json: TransactionApiResponse = await res.json();
  if (!json.success || !json.data)
    throw new Error(json.error?.message ?? 'Failed to fetch transactions');
  return json.data;
}

type SectionHeaderProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

function SectionHeader({ icon: Icon, title, description }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
    </div>
  );
}

function getErrorMessage(
  error: string | null,
  balanceError: Error | null,
  txError: Error | null
): string {
  if (error) return error;
  if (balanceError instanceof Error) return balanceError.message;
  if (txError instanceof Error) return txError.message;
  return 'Something went wrong';
}

export function BillingSettings({ success, canceled }: BillingSettingsProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  // Clear success/canceled from URL after showing
  useEffect(() => {
    if (success || canceled) {
      const timer = setTimeout(() => {
        window.history.replaceState({}, '', '/settings/billing');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, canceled]);

  // Refetch balance on success
  useEffect(() => {
    if (success) {
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_BALANCE_KEY],
      });
      void queryClient.invalidateQueries({
        queryKey: ['billing-transactions'],
      });
    }
  }, [success, queryClient]);

  const {
    data: balanceData,
    isLoading: balanceLoading,
    error: balanceError,
  } = useBillingBalance();

  // When billing is disabled server-side, show a simple message
  if (!balanceLoading && balanceData?.billingEnabled === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>
            Billing is not enabled for this instance.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const {
    data: txData,
    isLoading: txLoading,
    error: txError,
  } = useQuery({
    queryKey: ['billing-transactions'],
    queryFn: fetchTransactions,
    staleTime: 5 * 60 * 1000,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (amountUsd: number) => {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsd }),
      });
      const json: ApiResponse<{ url: string }> = await res.json();
      if (!json.success || !json.data)
        throw new Error(json.error?.message ?? 'Checkout failed');
      return json.data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    },
  });

  const autoTopUpMutation = useMutation({
    mutationFn: async (body: {
      enabled: boolean;
      thresholdUsd?: number;
      amountUsd?: number;
    }) => {
      const res = await fetch('/api/billing/auto-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json: ApiResponse<void> = await res.json();
      if (!json.success)
        throw new Error(json.error?.message ?? 'Failed to update');
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_BALANCE_KEY],
      });
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : 'Failed to update auto top-up'
      );
    },
  });

  const effectiveAmount = selectedAmount ?? parseFloat(customAmount);
  const isValidAmount =
    !isNaN(effectiveAmount) && effectiveAmount >= MIN_TOPUP_AMOUNT_USD;

  const handleTopUp = () => {
    if (!isValidAmount) {
      setError(`Minimum top-up is $${MIN_TOPUP_AMOUNT_USD}`);
      return;
    }
    checkoutMutation.mutate(effectiveAmount);
  };

  return (
    <div className="space-y-6">
      {success && (
        <Alert className="mb-4">
          <AlertDescription>
            Credits added successfully. Your balance has been updated.
          </AlertDescription>
        </Alert>
      )}

      {canceled && (
        <Alert className="mb-4">
          <AlertDescription>
            Top-up canceled. No charges were made.
          </AlertDescription>
        </Alert>
      )}

      {(error || balanceError || txError) && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {getErrorMessage(error, balanceError, txError)}
          </AlertDescription>
        </Alert>
      )}

      {/* Balance Card */}
      <Card>
        <CardHeader>
          <SectionHeader
            icon={Wallet}
            title="Credit Balance"
            description="Credits are used for image and video generation"
          />
        </CardHeader>
        <CardContent>
          {balanceLoading ? (
            <Skeleton className="h-12 w-32" />
          ) : (
            <p className="text-4xl font-bold tabular-nums">
              ${balanceData?.balance.toFixed(2) ?? '0.00'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Top Up Card */}
      <Card>
        <CardHeader>
          <SectionHeader
            icon={DollarSign}
            title="Add Credits"
            description="Choose an amount or enter a custom value"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PRESET_TOPUP_AMOUNTS_USD.map((amount) => (
              <Button
                key={amount}
                variant={selectedAmount === amount ? 'default' : 'outline'}
                className="h-12 text-lg font-semibold tabular-nums"
                onClick={() => {
                  setSelectedAmount(amount);
                  setCustomAmount('');
                  setError(null);
                }}
                disabled={checkoutMutation.isPending}
              >
                ${amount}
              </Button>
            ))}
          </div>

          <Separator />

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              min={MIN_TOPUP_AMOUNT_USD}
              step="1"
              placeholder={`Custom (${MIN_TOPUP_AMOUNT_USD}+)`}
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedAmount(null);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTopUp();
              }}
              className="pl-7 tabular-nums"
              autoComplete="off"
            />
          </div>

          <Button
            onClick={handleTopUp}
            disabled={!isValidAmount || checkoutMutation.isPending}
            className="w-full"
          >
            {checkoutMutation.isPending
              ? 'Loading…'
              : isValidAmount
                ? `Top up $${effectiveAmount}`
                : 'Top up'}
          </Button>
        </CardContent>
      </Card>

      {/* Auto Top-Up Card */}
      <Card>
        <CardHeader>
          <SectionHeader
            icon={RefreshCw}
            title="Auto Top-Up"
            description="Automatically add credits when your balance is low"
          />
        </CardHeader>
        <CardContent>
          {balanceLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !balanceData?.hasPaymentMethod ? (
            <p className="text-sm text-muted-foreground">
              Make your first top-up to save a payment method and enable auto
              top-up.
            </p>
          ) : (
            <AutoTopUpForm
              enabled={balanceData.autoTopUp.enabled}
              thresholdUsd={balanceData.autoTopUp.thresholdUsd ?? 5}
              amountUsd={balanceData.autoTopUp.amountUsd ?? 25}
              isPending={autoTopUpMutation.isPending}
              onSave={(settings) => autoTopUpMutation.mutate(settings)}
            />
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <SectionHeader
            icon={CreditCard}
            title="Transaction History"
            description="Recent credit activity"
          />
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : txData?.transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-2">
              {txData?.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.description ?? tx.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        tx.amount > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}${tx.amount.toFixed(2)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      ${tx.balanceAfter.toFixed(2)}
                    </Badge>
                    {tx.metadata?.receiptUrl && (
                      <a
                        href={tx.metadata.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="View receipt"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type AutoTopUpFormProps = {
  enabled: boolean;
  thresholdUsd: number;
  amountUsd: number;
  isPending: boolean;
  onSave: (settings: {
    enabled: boolean;
    thresholdUsd?: number;
    amountUsd?: number;
  }) => void;
};

function AutoTopUpForm({
  enabled: initialEnabled,
  thresholdUsd: initialThreshold,
  amountUsd: initialAmount,
  isPending,
  onSave,
}: AutoTopUpFormProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [threshold, setThreshold] = useState(String(initialThreshold));
  const [amount, setAmount] = useState(String(initialAmount));

  const handleSave = () => {
    onSave({
      enabled,
      thresholdUsd: parseFloat(threshold) || 5,
      amountUsd: parseFloat(amount) || 25,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant={enabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEnabled(true)}
        >
          On
        </Button>
        <Button
          variant={!enabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEnabled(false)}
        >
          Off
        </Button>
      </div>

      {enabled && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="threshold">When balance drops below</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="threshold"
                type="number"
                min="1"
                step="1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="pl-7 tabular-nums"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recharge">Top up with</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="recharge"
                type="number"
                min={MIN_TOPUP_AMOUNT_USD}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 tabular-nums"
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      )}

      <Button onClick={handleSave} disabled={isPending} className="w-full">
        {isPending ? 'Saving…' : 'Save auto top-up settings'}
      </Button>
    </div>
  );
}
