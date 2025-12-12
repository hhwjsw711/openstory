'use client';
import { ScenesView } from '@/components/scenes/scenes-view';
import { useUser } from '@/hooks/use-user';
import { use } from 'react';

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
      <ScenesView sequenceId={sequenceId} />
    </div>
  );
}
