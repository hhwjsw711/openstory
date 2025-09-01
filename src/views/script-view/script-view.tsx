import * as React from "react";
import { ScriptEditor } from "@/components/sequence/script-editor/script-editor";
import { StyleSelector } from "@/components/sequence/style-selector/style-selector";
import { Button } from "@/components/ui/button";
import {
  useCreateSequence,
  useGenerateStoryboard,
} from "@/hooks/use-sequences";
import { useStyles } from "@/hooks/use-styles";
import {
  useSequenceFormReducer,
  validateSequenceForm,
} from "@/reducers/sequence-form-reducer";

interface ScriptViewProps {
  teamId?: string;
  onSequenceCreated?: (sequenceId: string) => void;
  onStoryboardGenerated?: (jobId: string, sequenceId: string) => void;
}

export const ScriptView: React.FC<ScriptViewProps> = ({
  teamId,
  onSequenceCreated,
  onStoryboardGenerated,
}) => {
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
        "id" in sequenceResult
      ) {
        onSequenceCreated?.((sequenceResult as any).id);

        // Then generate the storyboard
        const job = await generateStoryboardMutation.mutateAsync(
          (sequenceResult as any).id,
        );

        const jobResult = job as unknown;
        if (
          jobResult &&
          typeof jobResult === "object" &&
          jobResult !== null &&
          "id" in jobResult
        ) {
          onStoryboardGenerated?.(
            (jobResult as any).id,
            (sequenceResult as any).id,
          );
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
  }, [
    state,
    dispatch,
    createSequenceMutation,
    generateStoryboardMutation,
    onSequenceCreated,
    onStoryboardGenerated,
  ]);

  // Progress indicator
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

  return (
    <div className="max-w-4xl mx-auto space-y-8" data-testid="script-view">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Setup Progress</span>
          <span className="font-medium">
            {progress.completed} of {progress.total} steps
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress.percentage}%` }}
            data-testid="progress-bar"
          />
        </div>
      </div>

      {/* Script Section */}
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Write Your Script</h2>
          <p className="text-muted-foreground">
            Start by writing your video script. Include scene descriptions,
            character names, and dialogue.
          </p>
        </div>

        <ScriptEditor
          value={state.script}
          onValueChange={handleScriptChange}
          error={state.validationErrors.script}
          maxLength={10000}
          placeholder="Enter your script here... For example:

FADE IN:

EXT. COFFEE SHOP - DAY

A bustling street corner with people walking by. SARAH, a young writer, sits by the window with her laptop..."
          disabled={state.isSubmitting}
        />
      </div>

      {/* Style Selection Section */}
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Choose Your Style</h2>
          <p className="text-muted-foreground">
            Select a visual style that matches your story's mood and aesthetic.
            This will be applied consistently across all frames.
          </p>
        </div>

        <StyleSelector
          selectedStyleId={state.selectedStyleId}
          onStyleSelect={handleStyleSelect}
          styles={stylesQuery.data || []}
          loading={stylesQuery.isLoading}
          disabled={state.isSubmitting}
        />

        {stylesQuery.isError && (
          <div
            className="text-sm text-destructive p-3 rounded-md bg-destructive/10"
            data-testid="styles-error"
          >
            Failed to load styles. Please try again.
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div className="flex flex-col gap-4 pt-4 border-t">
        <Button
          onClick={handleGenerateStoryboard}
          disabled={!canGenerateStoryboard}
          size="lg"
          className="w-full"
          data-testid="generate-button"
        >
          {state.isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2" />
              Generating Storyboard...
            </>
          ) : (
            "Generate Storyboard"
          )}
        </Button>

        {/* Error Message */}
        {state.submitError && (
          <div
            className="text-sm text-destructive p-3 rounded-md bg-destructive/10"
            data-testid="submit-error"
          >
            {state.submitError}
          </div>
        )}

        {/* Validation Help */}
        {!canGenerateStoryboard && !state.isSubmitting && (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>To generate your storyboard, you need to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              {state.script.trim().length < 10 && (
                <li>Write a script (at least 10 characters)</li>
              )}
              {!state.selectedStyleId && <li>Select a visual style</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
