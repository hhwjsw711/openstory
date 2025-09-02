"use client";

import * as React from "react";
import { PageContainer } from "@/components/layout";
import { GenerationSection } from "@/components/sequence/generation-section/generation-section";
import { ProgressSection } from "@/components/sequence/progress-section/progress-section";
import { ScriptSection } from "@/components/sequence/script-section/script-section";
import { StyleSection } from "@/components/sequence/style-section/style-section";
import {
  PageDescription,
  PageHeader,
  PageHeading,
} from "@/components/typography";
import {
  useCreateSequence,
  useGenerateStoryboard,
} from "@/hooks/use-sequences";
import { useStyles } from "@/hooks/use-styles";
import {
  useSequenceFormReducer,
  validateSequenceForm,
} from "@/reducers/sequence-form-reducer";

interface NewSequencePageProps {
  searchParams?: {
    teamId?: string;
  };
}

export const NewSequencePage: React.FC<NewSequencePageProps> = ({
  searchParams,
}) => {
  const teamId = searchParams?.teamId;

  const [state, dispatch] = useSequenceFormReducer({
    name: "Untitled Sequence", // Default name
  });

  // Hooks for data fetching and mutations
  const stylesQuery = useStyles(teamId);
  const createSequenceMutation = useCreateSequence();
  const generateStoryboardMutation = useGenerateStoryboard();

  // Check if we can generate storyboard
  const canGenerateStoryboard = React.useMemo(() => {
    return (
      state.script.trim().length >= 10 &&
      state.selectedStyleId !== null &&
      !state.isSubmitting
    );
  }, [state.script, state.selectedStyleId, state.isSubmitting]);

  // Handle script changes
  const handleScriptChange = React.useCallback(
    (value: string) => {
      dispatch({ type: "SET_SCRIPT", payload: value });
    },
    [dispatch],
  );

  // Handle style selection
  const handleStyleSelect = React.useCallback(
    (styleId: string) => {
      dispatch({ type: "SET_SELECTED_STYLE", payload: styleId });
    },
    [dispatch],
  );

  // Handle generate storyboard
  const handleGenerateStoryboard = React.useCallback(async () => {
    // Validate form first
    const errors = validateSequenceForm(state);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "SET_VALIDATION_ERRORS", payload: errors });
      return;
    }

    dispatch({ type: "SET_SUBMITTING", payload: true });

    try {
      // First create the sequence
      const sequence = await createSequenceMutation.mutateAsync({
        name: state.name,
        script: state.script,
        style_id: state.selectedStyleId || undefined,
      });

      const sequenceResult = sequence as unknown;
      if (
        sequenceResult &&
        typeof sequenceResult === "object" &&
        sequenceResult !== null &&
        "id" in sequenceResult &&
        typeof sequenceResult.id === "string"
      ) {
        // Then generate the storyboard
        const job = await generateStoryboardMutation.mutateAsync(
          sequenceResult.id,
        );

        const jobResult = job as unknown;
        if (
          jobResult &&
          typeof jobResult === "object" &&
          jobResult !== null &&
          "id" in jobResult
        ) {
          // Could navigate to sequence view here
          console.log("Sequence created and storyboard generation started");
        }
      }

      // Mark step as completed and move to next step
      dispatch({ type: "MARK_STEP_COMPLETED", payload: "script" });
      dispatch({ type: "SET_CURRENT_STEP", payload: "storyboard" });
    } catch (error) {
      dispatch({
        type: "SET_SUBMIT_ERROR",
        payload:
          error instanceof Error
            ? error.message
            : "Failed to generate storyboard",
      });
    } finally {
      dispatch({ type: "SET_SUBMITTING", payload: false });
    }
  }, [state, dispatch, createSequenceMutation, generateStoryboardMutation]);

  // Progress calculation
  const progress = React.useMemo(() => {
    let completed = 0;
    const total = 2;

    if (state.script.trim().length >= 10) completed++;
    if (state.selectedStyleId) completed++;

    return {
      completed,
      total,
      percentage: (completed / total) * 100,
    };
  }, [state.script, state.selectedStyleId]);

  // Validation requirements for generation section
  const validationRequirements = React.useMemo(
    () => ({
      hasScript: state.script.trim().length >= 10,
      hasStyle: Boolean(state.selectedStyleId),
    }),
    [state.script, state.selectedStyleId],
  );

  return (
    <PageContainer maxWidth="narrow" data-testid="new-sequence-page">
      <PageHeader>
        <PageHeading>Create New Sequence</PageHeading>
        <PageDescription>
          Transform your script into a professional video sequence with
          AI-powered visual generation.
        </PageDescription>
      </PageHeader>

      <ProgressSection progress={progress} />

      <ScriptSection
        script={state.script}
        onScriptChange={handleScriptChange}
        error={state.validationErrors.script}
        disabled={state.isSubmitting}
      />

      <StyleSection
        selectedStyleId={state.selectedStyleId}
        onStyleSelect={handleStyleSelect}
        styles={stylesQuery.data || []}
        loading={stylesQuery.isLoading}
        error={stylesQuery.isError}
        disabled={state.isSubmitting}
      />

      <GenerationSection
        onGenerateStoryboard={handleGenerateStoryboard}
        canGenerate={canGenerateStoryboard}
        isSubmitting={state.isSubmitting}
        submitError={state.submitError ?? undefined}
        validationRequirements={validationRequirements}
      />
    </PageContainer>
  );
};

export default NewSequencePage;
