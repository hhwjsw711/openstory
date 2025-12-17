import { PageContainer } from '@/components/layout';
import { ScriptView } from '@/components/script/script-view';
import {
  PageDescription,
  PageHeader,
  PageHeading,
} from '@/components/typography';
import { useSequence } from '@/hooks/use-sequences';
import { useUser } from '@/hooks/use-user';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/sequences/$id/script')({
  component: ScriptPage,
});

function ScriptPage() {
  const { id: sequenceId } = Route.useParams();
  const navigate = useNavigate();

  // Verify session
  useUser();

  const { data: sequence, isLoading: isLoadingSequence } =
    useSequence(sequenceId);

  const handleSuccess = (sequenceIds: string[]) => {
    // Navigate to storyboard page after successful generation
    if (sequenceIds.length > 0) {
      navigate({
        to: '/sequences/$id/scenes',
        params: { id: sequenceIds[0] },
      });
    }
  };

  const handleCancel = () => {
    // Navigate back to storyboard without making changes
    navigate({
      to: '/sequences/$id/scenes',
      params: { id: sequenceId },
    });
  };

  return (
    <div className="h-full" data-testid="edit-script-page">
      <PageContainer maxWidth="narrow" fullHeight>
        <PageHeader className="shrink-0">
          <PageHeading>Edit Script</PageHeading>
          <PageDescription>
            Update your script and regenerate the storyboard with new frames.
          </PageDescription>
        </PageHeader>

        <ScriptView
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          sequence={sequence}
          loading={isLoadingSequence || !sequence}
        />
      </PageContainer>
    </div>
  );
}
