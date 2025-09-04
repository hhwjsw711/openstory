"use client";
import { useRouter } from "next/navigation";
import { use, useCallback } from "react";
import { PageContainer } from "@/components/layout";
import { StepNavigation } from "@/components/sequence-flow/step-navigation";
import { StoryboardStep } from "@/components/sequence-flow/storyboard-step";
import {
  PageDescription,
  PageHeader,
  PageHeading,
} from "@/components/typography";
import {
  useActiveFrameGeneration,
  useFramesBySequence,
} from "@/hooks/use-frames";
import { useUser } from "@/hooks/use-user";

interface StoryboardPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function StoryboardPage({ params }: StoryboardPageProps) {
  const { id: sequenceId } = use(params);
  const router = useRouter();

  // Verify session
  useUser();

  // Check for active frame generation job
  const { data: activeJob } = useActiveFrameGeneration(sequenceId);
  const isBackgroundGenerating =
    activeJob?.status === "running" || activeJob?.status === "pending";

  // Load frames with auto-refresh when generating
  const { data: frames = [] } = useFramesBySequence(sequenceId, {
    // Refetch every 2 seconds when frames are being generated
    refetchInterval: isBackgroundGenerating ? 2000 : false,
  });

  // Completed steps based on what's in the sequence
  const completedSteps = new Set([1]); // Script is always completed to get here
  if (frames.length > 0) {
    completedSteps.add(2);
  }

  const handleNext = useCallback(() => {
    router.push(`/sequences/${sequenceId}/motion`);
  }, [sequenceId, router]);

  const handlePrevious = useCallback(() => {
    router.push(`/sequences/${sequenceId}/script`);
  }, [sequenceId, router]);

  return (
    <PageContainer maxWidth="narrow" data-testid="storyboard-page">
      <PageHeader>
        <PageHeading>Storyboard Generation</PageHeading>
        <PageDescription>
          Review and refine your AI-generated storyboard frames.
        </PageDescription>
      </PageHeader>

      <StepNavigation
        sequenceId={sequenceId}
        currentStep={2}
        completedSteps={completedSteps}
      />

      <StoryboardStep
        sequenceId={sequenceId}
        onNext={handleNext}
        onPrevious={handlePrevious}
      />
    </PageContainer>
  );
}
