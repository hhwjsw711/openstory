import { PageContainer } from '@/components/layout/page-container';
import { ScriptView } from '@/components/script/script-view';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect } from 'react';
import { Route as ScenesRoute } from '@/routes/_protected/sequences/$id/scenes';
export const Route = createFileRoute('/_protected/sequences/new')({
  component: NewSequencePage,
});

function NewSequencePage() {
  const navigate = useNavigate();

  // Clear billing return flag when user is back on this page
  useEffect(() => {
    localStorage.removeItem('openstory:billing-return');
  }, []);

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
        <ScriptView loading={false} onSuccess={handleSuccess} />
      </PageContainer>
    </div>
  );
}
