'use client';
import { ScenesView } from '@/components/scenes/scenes-view';
import { useSequence } from '@/hooks/use-sequences';
import { useUser } from '@/hooks/use-user';
import { DEFAULT_ASPECT_RATIO } from '@/lib/constants/aspect-ratios';
import { use } from 'react';

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
    <div className="h-full">
      <ScenesViewWrapper sequenceId={sequenceId} />
    </div>
  );
}
