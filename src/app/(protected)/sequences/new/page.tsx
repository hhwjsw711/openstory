'use client';
import { PageContainer } from '@/components/layout';
import { ScriptView } from '@/components/script/script-view';
import { useUser } from '@/hooks/use-user';
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
        router.push(`/sequences/${sequenceIds[0]}/scenes`);
      }
    },
    [router]
  );

  return (
    <div className="h-full overflow-auto">
      <PageContainer maxWidth="narrow">
        {/* Page Header */}

        <ScriptView loading={false} onSuccess={handleSuccess} autoFocus />
      </PageContainer>
    </div>
  );
}
