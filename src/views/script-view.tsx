import { DnaSelectionDialogWithTrigger } from '@/components/dna/dna-selection-dialog';
import { ScriptEditor } from '@/components/sequence/script-editor';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCreateSequence, useUpdateSequence } from '@/hooks/use-sequences';
import { useStyles } from '@/hooks/use-styles';
import { useUser } from '@/hooks/use-user';
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

  const { data: styles = [] } = useStyles();
  const selectedStyle = styles.find((s) => s.id === styleId);
  // TanStack Query mutations
  const createSequenceMutation = useCreateSequence();
  const updateSequenceMutation = useUpdateSequence();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Direct your Agents</CardTitle>{' '}
      </CardHeader>
      <CardContent>
        <CardDescription></CardDescription>
        <ScriptEditor
          value={script}
          onValueChange={setScript}
          placeholder="Describe a moment, a mood, or a script, then activate the crew to create it..."
        />
      </CardContent>
      <CardFooter>
        <DnaSelectionDialogWithTrigger
          styles={styles}
          selectedStyle={selectedStyle}
          onStyleSelect={setStyleId}
          buttonSize="sm"
        />
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
