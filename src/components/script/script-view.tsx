'use client';

import { GenerateSequenceIcon } from '@/components/icons/generate-sequence-icon';
import { ScriptEditor } from '@/components/script/script-editor';
import { GenerationSettings } from '@/components/settings/generation-settings';
import { StyleSelector } from '@/components/style/style-selector';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { useCreateSequence, useUpdateSequence } from '@/hooks/use-sequences';
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
  ANALYSIS_MODEL_IDS,
  DEFAULT_ANALYSIS_MODEL,
  type AnalysisModelId,
} from '@/lib/ai/models.config';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import type { Sequence } from '@/types/database';
import { useEffect, useMemo, useState, type FC } from 'react';

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

  const sequenceAnalysisModels: AnalysisModelId[] = useMemo(() => {
    return sequence?.analysisModel &&
      ANALYSIS_MODEL_IDS.includes(sequence?.analysisModel as AnalysisModelId)
      ? [sequence?.analysisModel as AnalysisModelId]
      : [DEFAULT_ANALYSIS_MODEL];
  }, [sequence]);

  const [analysisModels, setAnalysisModels] = useState<AnalysisModelId[]>(
    sequenceAnalysisModels
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    sequence?.aspectRatio || '16:9'
  );
  const [imageModel, setImageModel] = useState<TextToImageModel>(
    safeTextToImageModel(sequence?.imageModel, DEFAULT_IMAGE_MODEL)
  );
  const [motionModel, setMotionModel] = useState<ImageToVideoModel>(
    safeImageToVideoModel(sequence?.videoModel, DEFAULT_VIDEO_MODEL)
  );

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
          teamId,
          script: script || '',
          styleId: styleId,
          aspectRatio,
          analysisModels,
          imageModel,
          videoModel: motionModel,
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
    <Card variant="premium" className={flat ? 'border-none' : ''}>
      <form onSubmit={handleSubmit}>
        {/* Control bar */}
        <CardHeader className="flex items-start gap-3 px-6 py-4 border-b border-border/50 bg-card/40">
          <GenerationSettings
            aspectRatio={aspectRatio}
            analysisModels={analysisModels}
            imageModel={imageModel}
            motionModel={motionModel}
            onAspectRatioChange={setAspectRatio}
            onAnalysisModelsChange={setAnalysisModels}
            onImageModelChange={setImageModel}
            onMotionModelChange={setMotionModel}
            disabled={loading}
            singleSelectAnalysis={!!sequence?.id}
          />
        </CardHeader>

        <CardContent className="@container space-y-4 py-6">
          <ScriptEditor
            value={scriptValue}
            loading={!!loading}
            onValueChange={setScript}
            placeholder="Describe your sequence… Write a script, outline scenes, or paste your screenplay."
            showCharacterCount={false}
            maxLength={50000}
            autoFocus={autoFocus}
          />

          <StyleSelector
            styles={styles}
            selectedStyleId={styleId || sequence?.styleId || null}
            onStyleSelect={setStyleId}
            loading={isLoadingStyles}
          />
        </CardContent>

        <CardFooter className="flex-col gap-4 border-t py-4 border-border/30">
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
