'use client';
import { use, Suspense } from 'react';
import { useUser } from '@/hooks/use-user';
import { ScenesView } from '@/components/views/scenes-view';
import { Skeleton } from '@/components/ui/skeleton';

export default function ScenesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sequenceId } = use(params);

  // Verify session
  useUser();

  return (
    <Suspense
      fallback={
        <div className="flex h-screen overflow-hidden">
          <div className="w-80 border-r">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="flex flex-1 items-center justify-center p-8">
            <Skeleton className="aspect-video w-full max-w-4xl" />
          </div>
        </div>
      }
    >
      <ScenesView sequenceId={sequenceId} />
    </Suspense>
  );
}
