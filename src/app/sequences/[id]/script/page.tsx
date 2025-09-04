"use client";
import { redirect } from "next/navigation";
import { use, useCallback } from "react";
import { PageContainer } from "@/components/layout";
import { ScriptStep } from "@/components/sequence-flow/script-step";
import { StepNavigation } from "@/components/sequence-flow/step-navigation";
import {
  PageDescription,
  PageHeader,
  PageHeading,
} from "@/components/typography";
import { useUser } from "@/hooks/use-user";

export default function ScriptPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id: sequenceId } = use(params);
  // Verify session
  const { data: userData } = useUser();
  const _user = userData?.user;

  useUser();

  const handleSuccess = (updatedSequenceId: string) => {
    // Navigate to storyboard page after successful generation
    redirect(`/sequences/${updatedSequenceId}/storyboard`);
  };

  const handleStepClick = useCallback(
    (step: 1 | 2 | 3) => {
      switch (step) {
        case 1:
          // Already on script page
          break;
        case 2:
          redirect(`/sequences/${sequenceId}/storyboard`);
          break;
        case 3:
          redirect(`/sequences/${sequenceId}/motion`);

          break;
      }
    },
    [sequenceId],
  );

  return (
    <PageContainer maxWidth="narrow" data-testid="edit-script-page">
      <PageHeader>
        <PageHeading>Edit Script</PageHeading>
        <PageDescription>
          Update your script and regenerate the storyboard with new frames.
        </PageDescription>
      </PageHeader>
      <StepNavigation
        currentStep={1}
        completedSteps={new Set([1])}
        onStepClick={handleStepClick}
      />
      <ScriptStep sequenceId={sequenceId} onSuccess={handleSuccess} />
    </PageContainer>
  );
}
