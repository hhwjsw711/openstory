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
import { Skeleton } from '@/components/ui/skeleton';
import { BILLING_BALANCE_KEY } from '@/hooks/use-billing-balance';
import { BILLING_GATE_KEY } from '@/hooks/use-billing-gate';
import {
  createGiftTokenFn,
  isSystemAdminFn,
  listGiftTokensFn,
  redeemGiftTokenFn,
} from '@/functions/gift-tokens';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Check, Copy, Gift, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const RETURN_KEY = 'openstory:billing-return';

export function GiftCodeSettings() {
  const { data: adminStatus, isLoading: adminLoading } = useQuery({
    queryKey: ['system-admin-status'],
    queryFn: () => isSystemAdminFn(),
    staleTime: 5 * 60 * 1000,
  });

  function renderAdminSection() {
    if (adminLoading) return <Skeleton className="h-48 w-full" />;
    if (adminStatus?.isAdmin) return <AdminSection />;
    return null;
  }

  return (
    <div className="space-y-6">
      <RedeemSection />
      {renderAdminSection()}
    </div>
  );
}

function RedeemSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const redeemMutation = useMutation({
    mutationFn: (input: { code: string }) => redeemGiftTokenFn({ data: input }),
    onSuccess: (result) => {
      setCode('');
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_BALANCE_KEY],
      });
      void queryClient.invalidateQueries({
        queryKey: [...BILLING_GATE_KEY],
      });

      const returnTo = localStorage.getItem(RETURN_KEY);
      if (returnTo) {
        localStorage.removeItem(RETURN_KEY);
        toast.success(`$${result.amountUsd.toFixed(2)} added to your balance`, {
          description: `New balance: $${result.newBalance.toFixed(2)}`,
          action: {
            label: 'Continue creating',
            onClick: () => void navigate({ to: returnTo }),
          },
          duration: 15_000,
        });
      } else {
        toast.success(`$${result.amountUsd.toFixed(2)} added to your balance`, {
          description: `New balance: $${result.newBalance.toFixed(2)}`,
        });
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to redeem code');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    redeemMutation.mutate({ code: trimmed });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Gift className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Redeem Gift Code</CardTitle>
            <CardDescription>
              Enter a gift code to add credits to your team
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            name="code"
            placeholder="Enter code…"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono uppercase tracking-wider"
            maxLength={6}
            autoComplete="off"
            spellCheck={false}
            required
          />
          <Button
            type="submit"
            disabled={!code.trim() || redeemMutation.isPending}
          >
            {redeemMutation.isPending ? 'Redeeming…' : 'Redeem'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AdminSection() {
  return (
    <>
      <CreateGiftCodeCard />
      <GiftCodeListCard />
    </>
  );
}

function CreateGiftCodeCard() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: {
      amountUsd: number;
      note?: string;
      expiresInDays?: number;
    }) => createGiftTokenFn({ data: input }),
    onSuccess: (token) => {
      setCreatedCode(token.code);
      setAmount('');
      setNote('');
      setExpiresInDays('');
      void queryClient.invalidateQueries({ queryKey: ['gift-tokens'] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create gift code'
      );
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const amountUsd = parseFloat(amount);
    if (isNaN(amountUsd) || amountUsd <= 0) return;

    const parsedDays = parseInt(expiresInDays, 10);
    createMutation.mutate({
      amountUsd,
      note: note || undefined,
      expiresInDays: parsedDays > 0 ? parsedDays : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Create Gift Code</CardTitle>
            <CardDescription>
              Generate a new single-use gift code (admin only)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gift-amount">Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="gift-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="10.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7 tabular-nums"
                  autoComplete="off"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gift-expires">Expires in (days)</Label>
              <Input
                id="gift-expires"
                type="number"
                min="1"
                step="1"
                placeholder="No expiry"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gift-note">Note (optional)</Label>
            <Input
              id="gift-note"
              placeholder="e.g. Beta tester reward…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={!amount || createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create Gift Code'}
          </Button>
        </form>

        {createdCode && (
          <Alert>
            <AlertDescription className="flex items-center justify-between">
              <span>
                Gift code created:{' '}
                <span className="font-mono font-bold tracking-wider">
                  {createdCode}
                </span>
              </span>
              <CopyButton text={createdCode} />
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function GiftCodeListCard() {
  const { data: tokens, isLoading } = useQuery({
    queryKey: ['gift-tokens'],
    queryFn: () => listGiftTokensFn(),
    staleTime: 30_000,
  });

  function renderTokenList() {
    if (isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      );
    }

    if (!tokens?.length) {
      return (
        <p className="text-center text-muted-foreground py-4">
          No gift codes yet
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {tokens.map((token) => (
          <GiftTokenRow key={token.id} token={token} />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gift Codes</CardTitle>
        <CardDescription>All gift codes created by admins</CardDescription>
      </CardHeader>
      <CardContent>{renderTokenList()}</CardContent>
    </Card>
  );
}

type GiftTokenRowProps = {
  token: {
    id: string;
    code: string;
    status: string;
    note: string | null;
    createdAt: Date | string;
    expiresAt: Date | string | null;
    amountUsd: number;
  };
};

function GiftTokenRow({ token }: GiftTokenRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold tracking-wider">
            {token.code}
          </span>
          <StatusBadge status={token.status} />
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {token.note ? `${token.note} · ` : ''}
          {new Date(token.createdAt).toLocaleDateString()}
          {token.expiresAt &&
            ` · Expires ${new Date(token.expiresAt).toLocaleDateString()}`}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <span className="text-sm font-semibold tabular-nums">
          ${token.amountUsd.toFixed(2)}
        </span>
        {token.status === 'available' && <CopyButton text={token.code} />}
      </div>
    </div>
  );
}

function getStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'available':
      return 'default';
    case 'redeemed':
      return 'secondary';
    default:
      return 'destructive';
  }
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={getStatusVariant(status)}>{status}</Badge>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={handleCopy}
      aria-label="Copy code"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}
