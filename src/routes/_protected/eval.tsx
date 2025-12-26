import { EvalView } from '@/components/eval/eval-view';
import { PageContainer } from '@/components/layout/page-container';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/eval')({
  component: EvalPage,
});

function EvalPage() {
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
