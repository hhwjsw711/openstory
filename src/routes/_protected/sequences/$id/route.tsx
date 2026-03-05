import {
  ImageModelBadge,
  ModelBadge,
  VideoModelBadge,
} from '@/components/model/model-badge';
import { SequenceTabs } from '@/components/sequence/sequence-tabs';
import { PageHeader } from '@/components/typography/page-header';
import { PageHeading } from '@/components/typography/page-heading';
import { useSequence } from '@/hooks/use-sequences';
import { useUser } from '@/hooks/use-user';
import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/sequences/$id')({
  component: SequenceLayout,
});

function SequenceLayout() {
  const { id: sequenceId } = Route.useParams();
  const location = useLocation();

  useUser();

  const isScriptPage = location.pathname.endsWith('/script');

  if (isScriptPage) return <Outlet />;

  const { data: sequence } = useSequence(sequenceId);

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full max-w-[1920px] shrink-0 space-y-1 px-6 pt-4">
        <PageHeader>
          <PageHeading>{sequence?.title}</PageHeading>
          <ModelBadge model={sequence?.analysisModel} />
          <ImageModelBadge model={sequence?.imageModel} />
          <VideoModelBadge model={sequence?.videoModel} />
        </PageHeader>
        <SequenceTabs sequenceId={sequenceId} />
      </div>
      <div className="mx-auto w-full max-w-[1920px] flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
