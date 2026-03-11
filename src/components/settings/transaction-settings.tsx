/**
 * Transaction Settings Component
 * Full transaction history with infinite scroll and virtualization
 */

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CreditCard, ExternalLink } from 'lucide-react';
import React from 'react';

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

const PAGE_SIZE = 50;

async function fetchTransactions({
  limit,
  offset,
}: {
  limit: number;
  offset: number;
}): Promise<{ transactions: TransactionData[]; total: number }> {
  const res = await fetch(
    `/api/billing/transactions?limit=${limit}&offset=${offset}`
  );
  const json: TransactionApiResponse = await res.json();
  if (!json.success || !json.data)
    throw new Error(json.error?.message ?? 'Failed to fetch transactions');
  return json.data;
}

function TransactionRow({ tx }: { tx: TransactionData }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
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
  );
}

export function TransactionSettings() {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const {
    status,
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['billing-transactions'],
    queryFn: ({ pageParam }) =>
      fetchTransactions({ limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((p) => p.transactions).length;
      return loaded < lastPage.total ? loaded : undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  const allTransactions = data?.pages.flatMap((p) => p.transactions) ?? [];

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? allTransactions.length + 1 : allTransactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  React.useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();

    if (!lastItem) return;

    if (
      lastItem.index >= allTransactions.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allTransactions.length,
    isFetchingNextPage,
    rowVirtualizer.getVirtualItems(),
  ]);

  return (
    <div className="flex h-full flex-col gap-6">
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : 'Failed to load transactions'}
        </p>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Transaction History</h2>
          <p className="text-sm text-muted-foreground">All credit activity</p>
        </div>
      </div>

      {status === 'pending' ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : allTransactions.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">
          No transactions yet
        </p>
      ) : (
        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
          <div
            className="relative w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const isLoaderRow = virtualRow.index > allTransactions.length - 1;
              const tx = allTransactions[virtualRow.index];

              return (
                <div
                  key={virtualRow.index}
                  className="absolute left-0 w-full"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {isLoaderRow ? (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      {hasNextPage ? 'Loading more…' : ''}
                    </p>
                  ) : (
                    <div className="pb-2">
                      <TransactionRow tx={tx} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
