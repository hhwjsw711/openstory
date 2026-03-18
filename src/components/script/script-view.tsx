import { GenerateSequenceIcon } from '@/components/icons/generate-sequence-icon';
import { LocationSuggestionSelector } from '@/components/location-library/location-suggestion-selector';
import { GenerationSettings } from '@/components/settings/generation-settings';
import { StyleSelector } from '@/components/style/style-selector';
import { TalentSuggestionSelector } from '@/components/talent/talent-suggestion-selector';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { useCreateSequence } from '@/hooks/use-sequences';
import { useGenerationSettings } from '@/hooks/use-generation-settings';
import { useSequenceDraft } from '@/hooks/use-sequence-draft';
import { useBillingGate } from '@/hooks/use-billing-gate';
import { BillingGateDialog } from '@/components/billing/billing-gate-dialog';
import { useStyles } from '@/hooks/use-styles';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_MUSIC_MODEL,
  DEFAULT_VIDEO_MODEL,
  safeAudioModel,
  safeImageToVideoModel,
  safeTextToImageModel,
  type AudioModel,
  type ImageToVideoModel,
  type TextToImageModel,
} from '@/lib/ai/models';
import {
  DEFAULT_ANALYSIS_MODEL,
  isValidAnalysisModelId,
  type AnalysisModelId,
} from '@/lib/ai/models.config';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import { enhanceScriptStreamFn } from '@/functions/ai';
import { cn } from '@/lib/utils';
import type { Sequence } from '@/types/database';
import { Loader2, Sparkles } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState, type FC } from 'react';
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

  // Load draft from localStorage (script, style, talent, location)
  const {
    draft,
    isLoaded: draftLoaded,
    saveDraft,
    clearDraft,
  } = useSequenceDraft();

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
  const [musicModel, setMusicModel] = useState<AudioModel>(
    isEditing && sequence?.musicModel
      ? safeAudioModel(sequence.musicModel, DEFAULT_MUSIC_MODEL)
      : savedSettings.musicModel
  );
  const [autoGenerateMusic, setAutoGenerateMusic] = useState<boolean>(
    isEditing ? false : savedSettings.autoGenerateMusic
  );
  const [selectedTalentIds, setSelectedTalentIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

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

  // Sync draft state when creating new sequences (not editing)
  const hasSyncedDraftRef = React.useRef(false);
  useEffect(() => {
    if (isEditing) {
      hasSyncedDraftRef.current = false;
      return;
    }
    if (!draftLoaded) return;
    if (!hasSyncedDraftRef.current && draft.script) {
      setScript(draft.script);
      if (draft.styleId) setStyleId(draft.styleId);
      if (draft.selectedTalentIds.length > 0)
        setSelectedTalentIds(draft.selectedTalentIds);
      if (draft.selectedLocationIds.length > 0)
        setSelectedLocationIds(draft.selectedLocationIds);
      hasSyncedDraftRef.current = true;
    }
  }, [isEditing, draftLoaded, draft]);

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
      setMusicModel(savedSettings.musicModel);
      setAutoGenerateMusic(savedSettings.autoGenerateMusic);
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
        musicModel,
        autoGenerateMusic,
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
    musicModel,
    autoGenerateMusic,
    saveSettings,
  ]);

  // Persist draft to localStorage when creating new sequences
  useEffect(() => {
    if (!isEditing && draftLoaded) {
      saveDraft({
        script: script ?? '',
        styleId,
        selectedTalentIds,
        selectedLocationIds,
      });
    }
  }, [
    isEditing,
    draftLoaded,
    script,
    styleId,
    selectedTalentIds,
    selectedLocationIds,
    saveDraft,
  ]);

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const createSequenceMutation = useCreateSequence();
  const {
    needsBillingSetup,
    showGate,
    gateProps,
    hasFalKey,
    hasOpenRouterKey,
    hasCredits,
    stripeEnabled,
  } = useBillingGate();

  const handleCancel = onCancel;

  const executeRegeneration = () => {
    createSequenceMutation.mutate(
      {
        title: undefined,
        teamId,
        script: script ?? sequence?.script ?? '',
        styleId: styleId || sequence?.styleId || undefined,
        aspectRatio,
        analysisModels,
        imageModel,
        videoModel: motionModel,
        autoGenerateMotion,
        autoGenerateMusic,
        musicModel,
        suggestedTalentIds:
          selectedTalentIds.length > 0 ? selectedTalentIds : undefined,
        suggestedLocationIds:
          selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
      },
      {
        onSuccess: (result) => {
          clearDraft();
          if (onSuccess) {
            onSuccess(result.data.map((seq) => seq.id));
          }
        },
      }
    );
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    if (needsBillingSetup) {
      showGate();
      return;
    }

    if (isEditing) {
      setShowRegenerateConfirm(true);
      return;
    }

    executeRegeneration();
  };

  const previousScriptRef = useRef<string>('');

  const handleEnhance = async () => {
    if (needsBillingSetup) {
      showGate();
      return;
    }

    setIsEnhancing(true);
    setEnhanceError(null);
    previousScriptRef.current = scriptValue;
    setScript('');

    try {
      const selectedStyle = styles.find((s) => s.id === styleId);
      let accumulated = '';
      for await (const chunk of await enhanceScriptStreamFn({
        data: {
          script: scriptValue,
          styleConfig: selectedStyle?.config ?? undefined,
          analysisModel: analysisModels[0],
          aspectRatio,
        },
      })) {
        accumulated += chunk.delta;
        setScript(accumulated);
      }
    } catch (error) {
      setEnhanceError(
        error instanceof Error ? error.message : 'Failed to enhance script'
      );
      setScript(previousScriptRef.current);
    } finally {
      setIsEnhancing(false);
    }
  };

  const isFormValid =
    (script || sequence?.script) &&
    (styleId || sequence?.styleId) &&
    analysisModels.length > 0;

  const isSubmitting = createSequenceMutation.isPending;
  const isProcessing = sequence?.status === 'processing';
  const isDisabled = !isFormValid || isSubmitting || isProcessing;

  const scriptValue = script ?? sequence?.script ?? '';

  return (
    <Card
      variant="premium"
      className={cn('flex flex-col min-h-0 max-h-full', flat && 'border-none')}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-col min-h-0 max-h-full"
      >
        {/* Control bar */}
        <CardHeader className="shrink-0 flex flex-col md:flex-row items-start justify-between gap-3 px-6 py-4 border-b border-border/50 bg-card/40">
          <GenerationSettings
            aspectRatio={aspectRatio}
            analysisModels={analysisModels}
            imageModel={imageModel}
            motionModel={motionModel}
            autoGenerateMotion={autoGenerateMotion}
            musicModel={musicModel}
            autoGenerateMusic={autoGenerateMusic}
            onAspectRatioChange={setAspectRatio}
            onAnalysisModelsChange={setAnalysisModels}
            onImageModelChange={setImageModel}
            onMotionModelChange={setMotionModel}
            onAutoGenerateMotionChange={setAutoGenerateMotion}
            onMusicModelChange={setMusicModel}
            onAutoGenerateMusicChange={setAutoGenerateMusic}
            disabled={loading}
          />
          <div className="flex items-center gap-3">
            <TalentSuggestionSelector
              selectedTalentIds={selectedTalentIds}
              onSelectionChange={setSelectedTalentIds}
              disabled={loading}
            />
            <LocationSuggestionSelector
              selectedLocationIds={selectedLocationIds}
              onSelectionChange={setSelectedLocationIds}
              disabled={loading}
            />
          </div>
        </CardHeader>

        <CardContent className="min-h-0 @container flex flex-col gap-4 py-6 overflow-hidden">
          <div className="relative min-h-0 flex flex-col">
            <ScriptEditor
              value={scriptValue}
              onValueChange={setScript}
              maxLength={50000}
              placeholder="Describe your sequence… Write a script, outline scenes, or paste your screenplay."
              disabled={loading}
              autoFocus={autoFocus}
              showCharacterCount={false}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute bottom-2 right-2 gap-1.5 text-muted-foreground"
              disabled={
                !scriptValue ||
                scriptValue.length < 10 ||
                isEnhancing ||
                isSubmitting ||
                isProcessing
              }
              onClick={() => void handleEnhance()}
            >
              {isEnhancing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {isEnhancing ? 'Enhancing…' : 'Enhance'}
            </Button>
          </div>
          {enhanceError && (
            <p className="text-sm text-destructive">{enhanceError}</p>
          )}

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
              <span className="hidden sm:block text-xs text-muted-foreground">
                {analysisModels.length === 1
                  ? '1 sequence will be created'
                  : `${analysisModels.length} sequences will be created`}
              </span>
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
                  {sequence?.id ? 'Regenerate Sequence' : 'Generate Sequence'}
                </span>
                {/* Shine effect */}
                <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              </Button>
            </div>
          </div>
        </CardFooter>
      </form>
      <BillingGateDialog
        {...gateProps}
        hasFalKey={hasFalKey}
        hasOpenRouterKey={hasOpenRouterKey}
        hasCredits={hasCredits}
        stripeEnabled={stripeEnabled}
      />
      <AlertDialog
        open={showRegenerateConfirm}
        onOpenChange={setShowRegenerateConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate sequence?</AlertDialogTitle>
            <AlertDialogDescription>
              A new sequence will be created from this script.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowRegenerateConfirm(false);
                executeRegeneration();
              }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
