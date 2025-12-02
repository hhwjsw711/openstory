'use client';

import { EvalView } from '@/components/eval/eval-view';
import { PageContainer } from '@/components/layout';

export default function EvalPage() {
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <PageContainer
        maxWidth="full"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <EvalView />
      </PageContainer>
    </div>
  );
}
