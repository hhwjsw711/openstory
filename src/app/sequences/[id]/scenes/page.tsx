'use client';
import { ScenesView } from '@/components/scenes/scenes-view';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_ASPECT_RATIO } from '@/lib/constants/aspect-ratios';
import { useSequence } from '@/hooks/use-sequences';
import { useUser } from '@/hooks/use-user';
import { Suspense, use } from 'react';

function ScenesViewWrapper({ sequenceId }: { sequenceId: string }) {
  const { data: sequence } = useSequence(sequenceId);
  const aspectRatio = sequence?.aspectRatio || DEFAULT_ASPECT_RATIO;

  return <ScenesView sequenceId={sequenceId} aspectRatio={aspectRatio} />;
}

export default function ScenesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sequenceId } = use(params);

  // Verify session
  useUser();

  return (
    <div className="h-full overflow-hidden">
      <Suspense
        fallback={
          <div className="flex h-full overflow-hidden">
            <div className="w-80 border-r">
              <Skeleton className="h-full w-full" />
            </div>
            <div className="flex flex-1 items-center justify-center p-8">
              <Skeleton className="aspect-video w-full max-w-4xl" />
            </div>
          </div>
        }
      >
        <ScenesViewWrapper sequenceId={sequenceId} />
      </Suspense>
    </div>
  );
}
