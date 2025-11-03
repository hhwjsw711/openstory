import { ModelSelector } from '@/components/sequence/model-selector';
import { ScriptEditor } from '@/components/sequence/script-editor';
import { AspectRatioSelect } from '@/components/style/aspect-ratio-select';
import { StyleCompactSelector } from '@/components/style/style-compact-selector';
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
import { AnalysisModelId } from '@/lib/ai/models.config';
import { AspectRatio } from '@/lib/constants/aspect-ratios';
import { Zap } from 'lucide-react';
import { useState, type FC } from 'react';

export const ScriptView: FC<{
  teamId?: string;
  sequenceId?: string;
  onSuccess?: (sequenceIds: string[]) => void;
  flat?: boolean;
}> = ({ teamId, sequenceId, onSuccess, flat }) => {
  // Local state
  const [script, setScript] = useState<string>('');
  const [styleId, setStyleId] = useState<string | null>(null);

  const [analysisModels, setAnalysisModels] = useState<AnalysisModelId[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');

  // Get the styles from the database
  const { data: styles = [] } = useStyles();

  // TanStack Query mutations
  const createSequenceMutation = useCreateSequence();
  const updateSequenceMutation = useUpdateSequence();

  const handleSubmit = async () => {
    if (sequenceId) {
      updateSequenceMutation.mutate(
        {
          id: sequenceId,
          script,
          styleId: styleId || undefined,
          analysisModel: analysisModels[0],
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
          script,
          styleId,
          analysisModels,
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
      <CardContent className="space-y-4">
        <div className="flex flex-row gap-4">
          <ScriptEditor
            value={script}
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

        <StyleCompactSelector
          styles={styles}
          selectedStyleId={styleId}
          onStyleSelect={setStyleId}
        />
        <ModelSelector
          selectedModels={analysisModels}
          onModelsChange={(models) => setAnalysisModels(models)}
          disabled={false}
          singleSelect={false}
        />
      </CardContent>
      <CardFooter className="flex flex-col gap-2 justify-center items-center w-full">
        <Button
          variant="outline"
          onClick={handleSubmit}
          disabled={
            createSequenceMutation.isPending ||
            updateSequenceMutation.isPending ||
            !script ||
            !styleId ||
            analysisModels.length === 0
          }
        >
          <Zap className="size-4" />
          Activate Crew
        </Button>
      </CardFooter>
    </Card>
  );
};
