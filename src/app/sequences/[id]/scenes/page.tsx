'use client';
import { use } from 'react';
import { PageContainer } from '@/components/layout';
import {
  PageDescription,
  PageHeader,
  PageHeading,
} from '@/components/typography';
import { useUser } from '@/hooks/use-user';

export default function ScenesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sequenceId } = use(params);

  // Verify session
  useUser();

  return (
    <PageContainer data-testid="scenes-page">
      <PageHeader>
        <PageHeading>Scenes Editor - Sequence {sequenceId}</PageHeading>
        <PageDescription>
          Scene components will be implemented in subsequent phases
        </PageDescription>
      </PageHeader>
    </PageContainer>
  );
}
