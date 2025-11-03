'use client';
import { PageContainer } from '@/components/layout';
import {
  PageDescription,
  PageHeader,
  PageHeading,
} from '@/components/typography';
import { useUser } from '@/hooks/use-user';
import { ScriptView } from '@/views/script-view';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export default function NewSequencePage() {
  // Verify session
  const { data: userData } = useUser();
  const _user = userData?.user;

  const router = useRouter();

  const handleSuccess = useCallback(
    (sequenceIds: string[]) => {
      if (sequenceIds.length > 0) {
        // Navigate to storyboard page after successful generation
        router.push(`/sequences/${sequenceIds[0]}/storyboard`);
      }
    },
    [router]
  );

  return (
    <PageContainer maxWidth="narrow">
      {/* Page Header */}
      <PageHeader>
        <PageHeading>Create a new sequence</PageHeading>
        <PageDescription>
          Transform your script into a professional video sequence.
        </PageDescription>
      </PageHeader>
      <ScriptView loading={false} onSuccess={handleSuccess} />
    </PageContainer>
  );
}
