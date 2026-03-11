/**
 * Billing Settings Component
 * Credit balance, top-up buttons, auto-top-up config, and invoices
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { BILLING_GATE_KEY } from '@/hooks/use-billing-gate';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  DollarSign,
  ExternalLink,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type BillingSettingsProps = {
  success?: boolean;
  canceled?: boolean;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

type InvoiceData = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  metadata?: { receiptUrl?: string } | null;
  createdAt: string;
};

type InvoiceApiResponse = {
  success: boolean;
  data?: { transactions: InvoiceData[]; total: number };
  error?: { message?: string };
};

async function fetchInvoices(): Promise<{
  transactions: InvoiceData[];
  total: number;
}> {
  const res = await fetch(
    '/api/billing/transactions?type=credit_purchase&limit=10'
  );
  const json: InvoiceApiResponse = await res.json();
  if (!json.success || !json.data)
    throw new Error(json.error?.message ?? 'Failed to fetch invoices');
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
  balanceError: Error | null
): string {
  if (error) return error;
  if (balanceError instanceof Error) return balanceError.message;
  return 'Something went wrong';
}

const RETURN_KEY = 'openstory:billing-return';

export function BillingSettings({ success, canceled }: BillingSettingsProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(100);
  const [autoTopUpPrompt, setAutoTopUpPrompt] = useState<number | null>(null);
  const navigate = useNavigate();

  // Clear success/canceled from URL after showing
  useEffect(() => {
    if (success || canceled) {
      const timer = setTimeout(() => {
        window.history.replaceState({}, '', '/credits');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, canceled]);

  // Refetch balance on success + show return toast
  useEffect(() => {
    if (success) {
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_BALANCE_KEY],
      });
      void queryClient.invalidateQueries({
        queryKey: ['billing-invoices'],
      });
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_GATE_KEY],
      });

      const returnTo = localStorage.getItem(RETURN_KEY);
      if (returnTo) {
        localStorage.removeItem(RETURN_KEY);
        toast.success('Credits added successfully', {
          description: 'Your balance has been updated.',
          action: {
            label: 'Continue creating',
            onClick: () => void navigate({ to: returnTo }),
          },
          duration: 15_000,
        });
      }
    }
  }, [success, queryClient, navigate]);

  const {
    data: balanceData,
    isLoading: balanceLoading,
    error: balanceError,
  } = useBillingBalance();

  // After successful top-up, prompt to enable auto-topup if not already on
  useEffect(() => {
    if (!success || balanceLoading || !balanceData) return;
    if (balanceData.autoTopUp.enabled) return;

    const lastAmount = localStorage.getItem('openstory:last-topup-amount');
    localStorage.removeItem('openstory:last-topup-amount');
    const amount = lastAmount ? parseFloat(lastAmount) : null;
    if (amount && !isNaN(amount) && amount >= MIN_TOPUP_AMOUNT_USD) {
      setAutoTopUpPrompt(amount);
    }
  }, [success, balanceLoading, balanceData]);

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
    data: invoiceData,
    isLoading: invoicesLoading,
    error: invoicesError,
  } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: fetchInvoices,
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
  const autoTopUpThreshold =
    autoTopUpPrompt !== null ? Math.ceil((autoTopUpPrompt * 0.1) / 5) * 5 : 5;

  const handleTopUp = () => {
    if (!isValidAmount) {
      setError(`Minimum top-up is $${MIN_TOPUP_AMOUNT_USD}`);
      return;
    }
    // Remember the amount so we can suggest it for auto-topup after checkout
    localStorage.setItem(
      'openstory:last-topup-amount',
      String(effectiveAmount)
    );
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

      <AlertDialog open={autoTopUpPrompt !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable Auto Top-Up?</AlertDialogTitle>
            <AlertDialogDescription>
              Automatically add ${autoTopUpPrompt} when your balance drops below
              ${autoTopUpThreshold}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAutoTopUpPrompt(null)}>
              No thanks
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                autoTopUpMutation.mutate({
                  enabled: true,
                  thresholdUsd: autoTopUpThreshold,
                  amountUsd: autoTopUpPrompt ?? 0,
                });
                setAutoTopUpPrompt(null);
              }}
              disabled={autoTopUpMutation.isPending}
            >
              {autoTopUpMutation.isPending ? 'Enabling…' : 'Enable auto top-up'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(error || balanceError || invoicesError) && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {getErrorMessage(error, balanceError)}
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
          <div className="grid grid-cols-3 gap-3">
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
              type="text"
              inputMode="decimal"
              placeholder={`Custom (${MIN_TOPUP_AMOUNT_USD}+)`}
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value.replace(/[^0-9.]/g, ''));
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

          {!balanceLoading && !balanceData?.hasPaymentMethod && (
            <p className="text-xs text-muted-foreground">
              Your payment method will be saved. After your first purchase,
              you'll be able to enable auto top-up.
            </p>
          )}
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
              key={`${balanceData.autoTopUp.enabled}-${balanceData.autoTopUp.amountUsd}`}
              enabled={balanceData.autoTopUp.enabled}
              thresholdUsd={balanceData.autoTopUp.thresholdUsd ?? 5}
              amountUsd={balanceData.autoTopUp.amountUsd ?? 100}
              isPending={autoTopUpMutation.isPending}
              onSave={(settings) => autoTopUpMutation.mutate(settings)}
            />
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <SectionHeader
            icon={CreditCard}
            title="Invoices"
            description="Recent purchases"
          />
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : invoiceData?.transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No purchases yet
            </p>
          ) : (
            <div className="space-y-2">
              {invoiceData?.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.description ?? 'Credit purchase'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm font-semibold tabular-nums text-green-600 dark:text-green-400">
                      +${tx.amount.toFixed(2)}
                    </span>
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

              <div className="pt-2 text-center">
                <Link
                  to="/credits"
                  search={{ tab: 'transactions' }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  View all transactions
                </Link>
              </div>
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

  const save = (overrides?: { enabled?: boolean }) => {
    onSave({
      enabled: overrides?.enabled ?? enabled,
      thresholdUsd: parseFloat(threshold) || 5,
      amountUsd: parseFloat(amount) || 100,
    });
  };

  const handleToggle = (value: boolean) => {
    setEnabled(value);
    save({ enabled: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant={enabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleToggle(true)}
          disabled={isPending}
        >
          On
        </Button>
        <Button
          variant={!enabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleToggle(false)}
          disabled={isPending}
        >
          Off
        </Button>
        {isPending && (
          <span className="text-xs text-muted-foreground">Saving…</span>
        )}
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
                type="text"
                inputMode="decimal"
                value={threshold}
                onChange={(e) =>
                  setThreshold(e.target.value.replace(/[^0-9.]/g, ''))
                }
                onBlur={() => save()}
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
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9.]/g, ''))
                }
                onBlur={() => save()}
                className="pl-7 tabular-nums"
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
