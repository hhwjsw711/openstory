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
import { useUser } from '@/hooks/use-user';
import { AspectRatio } from '@/lib/constants/aspect-ratios';
import { Zap } from 'lucide-react';
import { useState, type FC } from 'react';

export const ScriptView: FC<{
  teamId: string;
  sequenceId?: string;
}> = ({ teamId, sequenceId }) => {
  // Get user data for conditional queries
  const { data: userData, isPending: isUserPending } = useUser();

  // Local state
  const [script, setScript] = useState<string>('');
  const [styleId, setStyleId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [analysisModels, setAnalysisModels] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const { data: styles = [] } = useStyles();
  const selectedStyle = styles.find((s) => s.id === styleId);
  // TanStack Query mutations
  const createSequenceMutation = useCreateSequence();
  const updateSequenceMutation = useUpdateSequence();

  return (
    <Card>
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
      </CardContent>
      <CardFooter className="flex flex-col gap-2 justify-center items-center w-full">
        <Button
          variant="outline"
          onClick={() =>
            createSequenceMutation.mutate({
              teamId,
              script,
              styleId,
              analysisModels,
            })
          }
        >
          <Zap className="size-4" />
          Activate Crew
        </Button>
      </CardFooter>
    </Card>
  );
};
