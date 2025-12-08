'use client';
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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-2 sm:overflow-auto sm:p-0">
      <div className="flex-1 flex flex-col min-h-0 sm:flex-none sm:max-w-4xl sm:mx-auto sm:py-8 sm:px-4">
        <ScriptView loading={false} onSuccess={handleSuccess} autoFocus />
      </div>
    </div>
  );
}
