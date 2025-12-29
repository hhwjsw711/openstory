import { GenerateSequenceIcon } from '@/components/icons/generate-sequence-icon';
import { GenerationSettings } from '@/components/settings/generation-settings';
import { StyleSelector } from '@/components/style/style-selector';
import { TalentSuggestionSelector } from '@/components/talent/talent-suggestion-selector';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { useCreateSequence, useUpdateSequence } from '@/hooks/use-sequences';
import { useGenerationSettings } from '@/hooks/use-generation-settings';
import { useStyles } from '@/hooks/use-styles';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  safeImageToVideoModel,
  safeTextToImageModel,
  type ImageToVideoModel,
  type TextToImageModel,
} from '@/lib/ai/models';
import {
  DEFAULT_ANALYSIS_MODEL,
  isValidAnalysisModelId,
  type AnalysisModelId,
} from '@/lib/ai/models.config';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import { cn } from '@/lib/utils';
import type { Sequence } from '@/types/database';
import React, { useEffect, useMemo, useState, type FC } from 'react';
import { ScriptEditor } from './script-editor';

export const ScriptView: FC<{
  teamId?: string;
  sequence?: Sequence;
  flat?: boolean;
  loading?: boolean;
  onSuccess?: (sequenceIds: string[]) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}> = ({
  teamId,
  sequence,
  loading = false,
  onSuccess,
  flat,
  onCancel,
  autoFocus = false,
}) => {
  // Local state - undefined until user makes an edit
  const [script, setScript] = useState<string | null | undefined>(
    sequence?.script
  );
  const [styleId, setStyleId] = useState<string | null>(
    sequence?.styleId || null
  );

  // Load saved settings from localStorage
  const {
    settings: savedSettings,
    isLoaded: settingsLoaded,
    save: saveSettings,
  } = useGenerationSettings();

  // Determine if we're editing an existing sequence
  const isEditing = !!sequence?.id;

  // Initialize with sequence values (if editing) or localStorage defaults (if creating)
  const sequenceAnalysisModels: AnalysisModelId[] = useMemo(() => {
    if (isEditing && sequence?.analysisModel) {
      return isValidAnalysisModelId(sequence.analysisModel)
        ? [sequence.analysisModel]
        : [DEFAULT_ANALYSIS_MODEL];
    }
    return savedSettings.analysisModels;
  }, [isEditing, sequence?.analysisModel, savedSettings.analysisModels]);

  const [analysisModels, setAnalysisModels] = useState<AnalysisModelId[]>(
    sequenceAnalysisModels
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    isEditing && sequence?.aspectRatio
      ? sequence.aspectRatio
      : savedSettings.aspectRatio
  );
  const [imageModel, setImageModel] = useState<TextToImageModel>(
    isEditing && sequence?.imageModel
      ? safeTextToImageModel(sequence.imageModel, DEFAULT_IMAGE_MODEL)
      : savedSettings.imageModel
  );
  const [motionModel, setMotionModel] = useState<ImageToVideoModel>(
    isEditing && sequence?.videoModel
      ? safeImageToVideoModel(sequence.videoModel, DEFAULT_VIDEO_MODEL)
      : savedSettings.motionModel
  );
  const [autoGenerateMotion, setAutoGenerateMotion] = useState<boolean>(
    isEditing ? false : savedSettings.autoGenerateMotion
  );
  const [selectedTalentIds, setSelectedTalentIds] = useState<string[]>([]);

  const { data: styles = [], isLoading: isLoadingStyles } = useStyles();

  // Auto-select first style if none selected
  useEffect(() => {
    if (
      !isLoadingStyles &&
      styles.length > 0 &&
      !styleId &&
      !sequence?.styleId
    ) {
      setStyleId(styles[0].id);
    }
  }, [styles, isLoadingStyles, styleId, sequence?.styleId]);

  // Sync state with savedSettings when creating new sequences (not when editing)
  // Use a ref to track if we've already synced to avoid loops
  const hasSyncedRef = React.useRef(false);
  useEffect(() => {
    // Reset sync flag when switching modes
    if (isEditing) {
      hasSyncedRef.current = false;
      return;
    }
    // Wait for localStorage to load before syncing
    if (!settingsLoaded) {
      return;
    }
    // Sync once when creating new sequence
    if (!hasSyncedRef.current) {
      setAspectRatio(savedSettings.aspectRatio);
      setAnalysisModels(savedSettings.analysisModels);
      setImageModel(savedSettings.imageModel);
      setMotionModel(savedSettings.motionModel);
      setAutoGenerateMotion(savedSettings.autoGenerateMotion);
      hasSyncedRef.current = true;
    }
  }, [isEditing, settingsLoaded, savedSettings]);

  // Persist settings to localStorage when creating new sequences (not when editing)
  // Only save after initial load to prevent overwriting with defaults
  useEffect(() => {
    if (!isEditing && settingsLoaded) {
      saveSettings({
        aspectRatio,
        analysisModels,
        imageModel,
        motionModel,
        autoGenerateMotion,
      });
    }
  }, [
    isEditing,
    settingsLoaded,
    aspectRatio,
    analysisModels,
    imageModel,
    motionModel,
    autoGenerateMotion,
    saveSettings,
  ]);

  const createSequenceMutation = useCreateSequence();
  const updateSequenceMutation = useUpdateSequence();

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    if (sequence?.id) {
      updateSequenceMutation.mutate(
        {
          id: sequence.id,
          script: script || sequence?.script || '',
          styleId: styleId || sequence?.styleId || undefined,
          analysisModel: analysisModels[0],
        },
        {
          onSuccess: (result) => {
            if (result.id && onSuccess) {
              onSuccess([result.id]);
            }
          },
        }
      );
    } else {
      createSequenceMutation.mutate(
        {
          title: undefined, // Will default to 'Untitled Sequence' in hook
          teamId,
          script: script || '',
          styleId: styleId || undefined,
          aspectRatio,
          analysisModels,
          imageModel,
          videoModel: motionModel,
          autoGenerateMotion,
          suggestedTalentIds:
            selectedTalentIds.length > 0 ? selectedTalentIds : undefined,
        },
        {
          onSuccess: (result) => {
            if (onSuccess) {
              onSuccess(result.data.map((sequence) => sequence.id));
            }
          },
        }
      );
    }
  };

  const isFormValid =
    (script || sequence?.script) &&
    (styleId || sequence?.styleId) &&
    analysisModels.length > 0;

  const isSubmitting =
    createSequenceMutation.isPending || updateSequenceMutation.isPending;
  const isDisabled = !isFormValid || isSubmitting;

  const scriptValue = script || sequence?.script || '';

  return (
    <Card
      variant="premium"
      className={cn('flex flex-col min-h-0 max-h-full', flat && 'border-none')}
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col min-h-0 max-h-full"
      >
        {/* Control bar */}
        <CardHeader className="shrink-0 flex items-start justify-between gap-3 px-6 py-4 border-b border-border/50 bg-card/40">
          <GenerationSettings
            aspectRatio={aspectRatio}
            analysisModels={analysisModels}
            imageModel={imageModel}
            motionModel={motionModel}
            autoGenerateMotion={autoGenerateMotion}
            onAspectRatioChange={setAspectRatio}
            onAnalysisModelsChange={setAnalysisModels}
            onImageModelChange={setImageModel}
            onMotionModelChange={setMotionModel}
            onAutoGenerateMotionChange={setAutoGenerateMotion}
            disabled={loading}
            singleSelectAnalysis={!!sequence?.id}
          />
          {/* Talent suggestion selector - only shown when creating new sequence */}
          {!isEditing && (
            <TalentSuggestionSelector
              selectedTalentIds={selectedTalentIds}
              onSelectionChange={setSelectedTalentIds}
              disabled={loading}
            />
          )}
        </CardHeader>

        <CardContent className="min-h-0 @container flex flex-col gap-4 py-6 overflow-hidden">
          <ScriptEditor
            value={scriptValue}
            onValueChange={setScript}
            maxLength={50000}
            placeholder="Describe your sequence… Write a script, outline scenes, or paste your screenplay."
            disabled={loading}
            autoFocus={autoFocus}
            showCharacterCount={false}
          />

          <div className="shrink-0">
            <StyleSelector
              styles={styles}
              selectedStyleId={styleId || sequence?.styleId || null}
              onStyleSelect={setStyleId}
              loading={isLoadingStyles}
            />
          </div>
        </CardContent>

        <CardFooter className="shrink-0 flex-col gap-4 border-t py-4 border-border/30">
          {/* Footer row - stacks on mobile, inline on desktop */}
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Meta info - hidden on mobile */}
            <div className="hidden sm:flex items-center gap-4">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <KbdGroup>
                  <Kbd>⌘</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>⏎</Kbd>
                </KbdGroup>
                <span className="ml-1">to generate</span>
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              {!sequence?.id && (
                <span className="hidden sm:block text-xs text-muted-foreground">
                  {analysisModels.length === 1
                    ? '1 sequence will be created'
                    : `${analysisModels.length} sequences will be created`}
                </span>
              )}
              {sequence?.id && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isDisabled}
                className="group relative px-6 bg-linear-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold tracking-wide shadow-lg shadow-primary/20 hover:shadow-primary/30 overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <GenerateSequenceIcon className="size-4" />
                  Activate Crew
                </span>
                {/* Shine effect */}
                <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              </Button>
            </div>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
};
