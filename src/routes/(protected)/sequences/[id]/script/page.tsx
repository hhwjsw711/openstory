'use client';
import { PageContainer } from '@/components/layout';
import { ScriptView } from '@/components/script/script-view';
import {
  PageDescription,
  PageHeader,
  PageHeading,
} from '@/components/typography';
import { useSequence } from '@/hooks/use-sequences';
import { useUser } from '@/hooks/use-user';
import { useRouter } from 'next/navigation';
import { use } from 'react';

export default function ScriptPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id: sequenceId } = use(params);

  const router = useRouter();
  // Verify session
  useUser();

  const { data: sequence, isLoading: isLoadingSequence } =
    useSequence(sequenceId);

  const handleSuccess = (sequenceIds: string[]) => {
    // Navigate to storyboard page after successful generation
    if (sequenceIds.length > 0) {
      router.push(`/sequences/${sequenceIds[0]}/scenes`);
    }
  };

  const handleCancel = () => {
    // Navigate back to storyboard without making changes
    router.push(`/sequences/${sequenceId}/scenes`);
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
