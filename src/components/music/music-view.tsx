import { MusicModelSelector } from '@/components/model/music-model-selector';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_MUSIC_MODEL,
  getAudioModelDurationLimits,
  safeAudioModel,
  type AudioModel,
} from '@/lib/ai/models';
import type { Sequence } from '@/types/database';
import {
  AlertCircle,
  AlertTriangle,
  Film,
  Loader2,
  Music,
  Volume2,
} from 'lucide-react';
import { useState } from 'react';

type GenerateMusicArgs = {
  prompt?: string;
  tags?: string;
  model?: string;
  duration?: number;
};

type MusicViewProps = {
  sequence: Sequence;
  videoDuration?: number;
  onGenerateMusic: (args?: GenerateMusicArgs) => void;
  isGeneratingMusic: boolean;
  onMergeVideoAndMusic: () => void;
  isMergingVideoAndMusic: boolean;
};

type LoadingButtonProps = React.ComponentProps<typeof Button> & {
  isLoading: boolean;
  loadingText: string;
  children: React.ReactNode;
};

const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  loadingText,
  children,
  ...props
}) => (
  <Button disabled={isLoading || props.disabled} {...props}>
    {isLoading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {loadingText}
      </>
    ) : (
      children
    )}
  </Button>
);

type ReadOnlyFieldProps = {
  label: string;
  value: string;
};

const ReadOnlyField: React.FC<ReadOnlyFieldProps> = ({ label, value }) => (
  <div className="w-full max-w-lg flex flex-col gap-2">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
      {value}
    </p>
  </div>
);

export const MusicView: React.FC<MusicViewProps> = ({
  sequence,
  videoDuration,
  onGenerateMusic,
  isGeneratingMusic,
  onMergeVideoAndMusic,
  isMergingVideoAndMusic,
}) => {
  const {
    musicStatus,
    musicUrl,
    musicError,
    musicModel,
    musicPrompt,
    musicTags,
  } = sequence;

  const [editPrompt, setEditPrompt] = useState(musicPrompt ?? '');
  const [editTags, setEditTags] = useState(musicTags ?? '');
  const [editModel, setEditModel] = useState<AudioModel>(
    safeAudioModel(musicModel, DEFAULT_MUSIC_MODEL)
  );
  const [editDuration, setEditDuration] = useState<number | undefined>(
    videoDuration
  );

  const durationLimits = getAudioModelDurationLimits(editModel);
  const effectiveDuration =
    editDuration ?? videoDuration ?? durationLimits.default;
  const durationExceedsMax = effectiveDuration > durationLimits.max;

  function handleGenerate(): void {
    onGenerateMusic({
      prompt: editPrompt || undefined,
      tags: editTags || undefined,
      model: editModel,
      duration: editDuration,
    });
  }

  // Completed — show audio player + prompt (read-only) + merge button
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
        <div className="w-full max-w-lg flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Model</Label>
          <MusicModelSelector
            selectedModel={editModel}
            onModelChange={setEditModel}
          />
        </div>

        {musicPrompt && <ReadOnlyField label="Prompt" value={musicPrompt} />}
        {musicTags && <ReadOnlyField label="Tags" value={musicTags} />}

        <div className="flex gap-3">
          <LoadingButton
            variant="outline"
            onClick={handleGenerate}
            isLoading={isGeneratingMusic}
            loadingText="Regenerating…"
          >
            Regenerate Music
          </LoadingButton>
          <LoadingButton
            onClick={onMergeVideoAndMusic}
            isLoading={isMerging}
            loadingText="Merging…"
          >
            <Film className="mr-2 h-4 w-4" />
            Merge with Video
          </LoadingButton>
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
        <div className="w-full max-w-xs flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Model</Label>
          <MusicModelSelector
            selectedModel={editModel}
            onModelChange={setEditModel}
          />
        </div>
        <LoadingButton
          onClick={handleGenerate}
          isLoading={isGeneratingMusic}
          loadingText="Retrying…"
        >
          Retry
        </LoadingButton>
      </div>
    );
  }

  // Pending — with stored prompt: show editable prompt/tags/model
  if (musicPrompt) {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <Music className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">Music prompt ready</p>

        <div className="w-full max-w-lg flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="music-prompt">Prompt</Label>
            <Textarea
              id="music-prompt"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={4}
              placeholder="Descriptive music prompt…"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="music-tags">Tags</Label>
            <Textarea
              id="music-tags"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              rows={2}
              placeholder="Comma-separated genre/style tags…"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Model</Label>
            <MusicModelSelector
              selectedModel={editModel}
              onModelChange={setEditModel}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="music-duration">Duration (seconds)</Label>
            <input
              id="music-duration"
              type="number"
              min={1}
              max={durationLimits.max}
              value={effectiveDuration}
              onChange={(e) => setEditDuration(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            {durationExceedsMax && (
              <p className="flex items-center gap-1.5 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                Video is {Math.round(effectiveDuration)}s but {editModel} max is{' '}
                {durationLimits.max}s — music will be clamped.
              </p>
            )}
          </div>
        </div>

        <LoadingButton
          onClick={handleGenerate}
          disabled={!editPrompt}
          isLoading={isGeneratingMusic}
          loadingText="Generating…"
        >
          Generate Music
        </LoadingButton>
      </div>
    );
  }

  // Pending — no stored prompt (legacy sequences)
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Music className="h-8 w-8 text-muted-foreground" />
      <p className="text-muted-foreground">No music track yet</p>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        Generate a background music track based on your sequence&apos;s scene
        audio design.
      </p>
      <div className="w-full max-w-xs flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Model</Label>
        <MusicModelSelector
          selectedModel={editModel}
          onModelChange={setEditModel}
        />
      </div>
      <LoadingButton
        onClick={handleGenerate}
        isLoading={isGeneratingMusic}
        loadingText="Generating…"
      >
        Generate Music
      </LoadingButton>
    </div>
  );
};

export const MusicViewSkeleton: React.FC = () => (
  <div className="flex flex-col items-center gap-6 py-12">
    <Skeleton className="h-10 w-10 rounded-full" />
    <Skeleton className="h-10 w-full max-w-lg" />
  </div>
);
