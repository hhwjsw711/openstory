import { MusicView, MusicViewSkeleton } from '@/components/music/music-view';
import { SequenceTabs } from '@/components/sequence/sequence-tabs';
import { generateMusicFn, mergeVideoAndMusicFn } from '@/functions/sequences';
import { useSequence, sequenceKeys } from '@/hooks/use-sequences';
import { useUser } from '@/hooks/use-user';
import { useGenerationStream } from '@/lib/realtime/use-generation-stream';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { Sequence } from '@/types/database';

export const Route = createFileRoute('/_protected/sequences/$id/music')({
  component: MusicPage,
});

function MusicPage() {
  const { id: sequenceId } = Route.useParams();

  useUser();

  const { data: sequence, isLoading } = useSequence(sequenceId);
  const queryClient = useQueryClient();

  // Subscribe to realtime events (audio:progress updates sequence cache)
  useGenerationStream(sequenceId);

  const generateMusic = useMutation({
    mutationFn: (args?: { prompt?: string; tags?: string; model?: string }) =>
      generateMusicFn({
        data: {
          sequenceId,
          prompt: args?.prompt,
          tags: args?.tags,
          model: args?.model,
        },
      }),
    onMutate: () => {
      queryClient.setQueryData<Sequence>(
        sequenceKeys.detail(sequenceId),
        (old) => (old ? { ...old, musicStatus: 'generating' as const } : old)
      );
    },
  });

  const mergeVideoAndMusic = useMutation({
    mutationFn: () => mergeVideoAndMusicFn({ data: { sequenceId } }),
    onMutate: () => {
      queryClient.setQueryData<Sequence>(
        sequenceKeys.detail(sequenceId),
        (old) => (old ? { ...old, mergedVideoStatus: 'merging' as const } : old)
      );
    },
  });

  if (isLoading || !sequence) {
    return (
      <div className="flex h-full flex-col">
        <SequenceTabs sequenceId={sequenceId} />
        <div className="flex-1 p-4">
          <div className="max-w-4xl mx-auto">
            <MusicViewSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <SequenceTabs sequenceId={sequenceId} />
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          <MusicView
            sequence={sequence}
            onGenerateMusic={(args) => generateMusic.mutate(args)}
            isGeneratingMusic={generateMusic.isPending}
            onMergeVideoAndMusic={() => mergeVideoAndMusic.mutate()}
            isMergingVideoAndMusic={mergeVideoAndMusic.isPending}
          />
        </div>
      </div>
    </div>
  );
}
