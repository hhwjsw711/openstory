'use client';
import { PageContainer } from '@/components/layout';
import { ScriptView } from '@/components/script/script-view';
import { useUser } from '@/hooks/use-user';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

export const Route = createFileRoute('/_protected/sequences/new')({
  component: NewSequencePage,
});

function NewSequencePage() {
  // Verify session
  const { data: userData } = useUser();
  const _user = userData?.user;

  const navigate = useNavigate();

  const handleSuccess = useCallback(
    (sequenceIds: string[]) => {
      if (sequenceIds.length > 0) {
        // Navigate to storyboard page after successful generation
        navigate({
          to: '/sequences/$id/scenes',
          params: { id: sequenceIds[0] },
        });
      }
    },
    [navigate]
  );

  return (
    <div className="h-full">
      <PageContainer maxWidth="narrow" fullHeight>
        <ScriptView loading={false} onSuccess={handleSuccess} autoFocus />
      </PageContainer>
    </div>
  );
}
