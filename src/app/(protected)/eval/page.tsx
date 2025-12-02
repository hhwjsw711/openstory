'use client';

import { PageContainer } from '@/components/layout';
import {
  PageDescription,
  PageHeader,
  PageHeading,
} from '@/components/typography';
import { EvalView } from '@/components/eval/eval-view';

export default function EvalPage() {
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <PageContainer
        maxWidth="full"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <PageHeader>
          <PageHeading>Prompt Evaluation</PageHeading>
          <PageDescription>
            Compare image prompts and generated thumbnails across sequences.
          </PageDescription>
        </PageHeader>
        <EvalView />
      </PageContainer>
    </div>
  );
}
