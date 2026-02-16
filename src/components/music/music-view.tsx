import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Sequence } from '@/types/database';
import { AlertCircle, Loader2, Music, Volume2, Film } from 'lucide-react';

type MusicViewProps = {
  sequence: Sequence;
  onGenerateMusic: () => void;
  isGeneratingMusic: boolean;
  onMergeVideoAndMusic: () => void;
  isMergingVideoAndMusic: boolean;
};

export const MusicView: React.FC<MusicViewProps> = ({
  sequence,
  onGenerateMusic,
  isGeneratingMusic,
  onMergeVideoAndMusic,
  isMergingVideoAndMusic,
}) => {
  const { musicStatus, musicUrl, musicError, musicModel } = sequence;

  // Completed — show audio player + merge button
  if (musicStatus === 'completed' && musicUrl) {
    const isMerging =
      isMergingVideoAndMusic || sequence.mergedVideoStatus === 'merging';

    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <Volume2 className="h-10 w-10 text-muted-foreground" />
        <div className="w-full max-w-lg">
          <audio
            controls
            src={musicUrl}
            className="h-10 w-full"
            preload="metadata"
          >
            <track kind="captions" />
          </audio>
        </div>
        {musicModel && (
          <p className="text-xs text-muted-foreground">Model: {musicModel}</p>
        )}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onGenerateMusic}
            disabled={isGeneratingMusic}
          >
            {isGeneratingMusic ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Regenerating…
              </>
            ) : (
              'Regenerate Music'
            )}
          </Button>
          <Button onClick={onMergeVideoAndMusic} disabled={isMerging}>
            {isMerging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Merging…
              </>
            ) : (
              <>
                <Film className="mr-2 h-4 w-4" />
                Merge with Video
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Generating
  if (musicStatus === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Generating music…</p>
      </div>
    );
  }

  // Failed
  if (musicStatus === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-destructive">Music generation failed</p>
        {musicError && (
          <p className="text-sm text-muted-foreground max-w-md text-center">
            {musicError}
          </p>
        )}
        <Button onClick={onGenerateMusic} disabled={isGeneratingMusic}>
          {isGeneratingMusic ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Retrying…
            </>
          ) : (
            'Retry'
          )}
        </Button>
      </div>
    );
  }

  // Pending
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Music className="h-8 w-8 text-muted-foreground" />
      <p className="text-muted-foreground">No music track yet</p>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        Generate a background music track based on your sequence&apos;s scene
        audio design.
      </p>
      <Button onClick={onGenerateMusic} disabled={isGeneratingMusic}>
        {isGeneratingMusic ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          'Generate Music'
        )}
      </Button>
    </div>
  );
};

export const MusicViewSkeleton: React.FC = () => (
  <div className="flex flex-col items-center gap-6 py-12">
    <Skeleton className="h-10 w-10 rounded-full" />
    <Skeleton className="h-10 w-full max-w-lg" />
  </div>
);
