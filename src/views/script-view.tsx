import { ModelSelector } from '@/components/sequence/model-selector';
import { ScriptEditor } from '@/components/sequence/script-editor';
import { AspectRatioSelect } from '@/components/style/aspect-ratio-select';
import { StyleSelector } from '@/components/style/style-selector';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useCreateSequence, useUpdateSequence } from '@/hooks/use-sequences';
import { useStyles } from '@/hooks/use-styles';
import {
  ANALYSIS_MODEL_IDS,
  AnalysisModelId,
  DEFAULT_ANALYSIS_MODEL,
} from '@/lib/ai/models.config';
import { AspectRatio } from '@/lib/constants/aspect-ratios';
import { Sequence } from '@/types/database';
import { Zap } from 'lucide-react';
import { useMemo, useState, type FC } from 'react';

export const ScriptView: FC<{
  teamId?: string;
  sequence?: Sequence;
  flat?: boolean; // if true, the card will have no border
  loading?: boolean;
  onSuccess?: (sequenceIds: string[]) => void; // called when the sequence is created or updated
  onCancel?: () => void; // called when the user cancels the script
}> = ({ teamId, sequence, loading = false, onSuccess, flat, onCancel }) => {
  // The way state is managed is a bit confusing - but perfectly logical
  // Local state is undefined until the user makeas an edit.
  // We pass the value of local state to each field first
  // If we are editing an existing sequence we pass the existing value to each field that is editable.
  // e.g. value={script || sequence?.script || ''}

  // This saves us from using complex useEffect logic to update the state when the sequence changes.

  // Local state
  const [script, setScript] = useState<string | null | undefined>(
    sequence?.script
  );
  const [styleId, setStyleId] = useState<string | null>(
    sequence?.styleId || null
  );

  // Get the analysis model from the existing sequence or use the default model
  const sequenceAnalysisModels: AnalysisModelId[] | undefined = useMemo(() => {
    return sequence?.analysisModel &&
      ANALYSIS_MODEL_IDS.includes(sequence?.analysisModel as AnalysisModelId)
      ? [sequence?.analysisModel as AnalysisModelId]
      : undefined;
  }, [sequence]);

  const [analysisModels, setAnalysisModels] = useState<
    AnalysisModelId[] | undefined
  >(sequenceAnalysisModels);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');

  // Get the styles from the database
  const { data: styles = [], isLoading: isLoadingStyles } = useStyles();

  // TanStack Query mutations
  const createSequenceMutation = useCreateSequence();
  const updateSequenceMutation = useUpdateSequence();

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const handleSubmit = async () => {
    if (sequence?.id) {
      updateSequenceMutation.mutate(
        {
          id: sequence.id,
          script: script || sequence?.script || '',
          styleId: styleId || sequence?.styleId || undefined,
          analysisModel: analysisModels?.[0] || DEFAULT_ANALYSIS_MODEL,
        },
        {
          onSuccess: (result) => {
            // Update single sequence
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
          analysisModels: analysisModels ||
            sequenceAnalysisModels || [DEFAULT_ANALYSIS_MODEL],
        },
        {
          onSuccess: (result) => {
            // Multi-model creation returns array of sequences
            if (onSuccess) {
              onSuccess(result.data.map((sequence) => sequence.id));
            }
          },
        }
      );
    }
  };

  return (
    <Card className={flat ? 'border-none' : ''}>
      <CardHeader>
        <CardTitle>Describe a moment, a mood, or a script</CardTitle>{' '}
      </CardHeader>
      <CardContent className="@container space-y-4">
        <div className="flex flex-col @lg:flex-row gap-4">
          <ScriptEditor
            value={script || sequence?.script || ''}
            loading={!!loading}
            onValueChange={setScript}
            placeholder="The camera pushes through a haze of orange light as the city wakes…"
            showCharacterCount={false}
          />
          <div className="flex flex-col gap-2">
            <Label className="whitespace-nowrap">Aspect Ratio</Label>
            <AspectRatioSelect
              value={aspectRatio}
              onChange={setAspectRatio}
              variant="vertical"
            />
          </div>
        </div>

        <StyleSelector
          styles={styles}
          selectedStyleId={styleId || sequence?.styleId || null}
          onStyleSelect={setStyleId}
          loading={isLoadingStyles}
        />
        <ModelSelector
          selectedModels={
            analysisModels || sequenceAnalysisModels || [DEFAULT_ANALYSIS_MODEL]
          }
          onModelsChange={(models) => setAnalysisModels(models)}
          disabled={loading}
          singleSelect={!!sequence?.id}
        />
      </CardContent>
      <CardFooter className="flex flex-col gap-2 justify-center items-center w-full">
        <div className="flex flex-row gap-2">
          {sequence?.id && (
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleSubmit}
            disabled={
              createSequenceMutation.isPending ||
              updateSequenceMutation.isPending ||
              !(script || sequence?.script) ||
              !(styleId || sequence?.styleId) ||
              (
                analysisModels ||
                sequenceAnalysisModels || [DEFAULT_ANALYSIS_MODEL]
              ).length === 0
            }
          >
            <Zap className="size-4" />
            Activate Crew
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
