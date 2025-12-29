import { PageContainer } from '@/components/layout/page-container';
import { ScriptView } from '@/components/script/script-view';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { Route as ScenesRoute } from '@/routes/_protected/sequences/$id/scenes';
export const Route = createFileRoute('/_protected/sequences/new')({
  component: NewSequencePage,
});

function NewSequencePage() {
  const navigate = useNavigate();

  const handleSuccess = useCallback(
    (sequenceIds: string[]) => {
      if (sequenceIds.length > 0) {
        // Navigate to storyboard page after successful generation
        void navigate({
          to: ScenesRoute.to,
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
