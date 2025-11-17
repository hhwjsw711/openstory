import { ImageModelSelector } from '@/components/sequence/image-model-selector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_IMAGE_MODEL, TextToImageModel } from '@/lib/ai/models';
import { Frame } from '@/types/database';
import { useQueryClient } from '@tanstack/react-query';
import { CopyIcon, Loader2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export type TabValue = 'script' | 'image-prompt' | 'motion-prompt';

type SceneScriptPromptsProps = {
  frame?: Frame | undefined;
  selectedTab: TabValue;
  onTabChange: (tab: TabValue) => void;
};

type PromptTabContentProps = {
  text: string | undefined;
  isCopied: boolean;
  onCopy: () => void;
  showDuration?: boolean;
  durationMs?: number | null;
};

const PromptTabContent: React.FC<PromptTabContentProps> = ({
  text,
  isCopied,
  onCopy,
  showDuration,
  durationMs,
}) => {
  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute right-0 top-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={onCopy}
            disabled={!text}
            className="h-8 w-8 p-0"
          >
            {isCopied ? (
              <span className="text-xs">✓</span>
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="prose prose-sm max-w-none pr-10">
          {text ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {text}
            </p>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
              <Skeleton className="h-4 w-9/12" />
            </div>
          )}
        </div>
      </div>
      {showDuration &&
        durationMs !== undefined &&
        durationMs !== null &&
        durationMs > 0 && (
          <div className="text-xs text-muted-foreground">
            Duration: {(durationMs / 1000).toFixed(1)}s
          </div>
        )}
    </div>
  );
};

export const SceneScriptPrompts: React.FC<SceneScriptPromptsProps> = ({
  frame,
  selectedTab,
  onTabChange,
}) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<
    TextToImageModel | undefined
  >(undefined);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isShortening, setIsShortening] = useState(false);
  const [shortenError, setShortenError] = useState<string | null>(null);
  const [shortenSuccess, setShortenSuccess] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleCopy = useCallback(
    async (text: string | undefined, tabName: string) => {
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        setCopiedTab(tabName);
        setTimeout(() => setCopiedTab(null), 2000);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    },
    []
  );

  // Get imagePrompt early so it can be used in handleShortenPrompt
  const scriptText = frame?.metadata?.originalScript?.extract;
  const imageModel = frame?.imageModel as TextToImageModel;
  const imagePrompt =
    frame?.imagePrompt || frame?.metadata?.prompts?.visual?.fullPrompt;

  const handleShortenPrompt = useCallback(async () => {
    setShortenError(null);
    setShortenSuccess(null);

    const currentPrompt = editedPrompt || imagePrompt;
    if (!currentPrompt || currentPrompt.length < 20) {
      setShortenError('Prompt is too short to shorten');
      return;
    }

    setIsShortening(true);

    try {
      const response = await fetch('/api/prompts/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to shorten prompt');
      }

      if (result.success && result.data?.shortenedPrompt) {
        setEditedPrompt(result.data.shortenedPrompt);
        setShortenSuccess(
          `Prompt shortened by ${result.data.reductionPercent}% (${result.data.originalLength} → ${result.data.shortenedLength} chars)`
        );
        // Clear success message after 5 seconds
        setTimeout(() => setShortenSuccess(null), 5000);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Failed to shorten prompt:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to shorten prompt';
      setShortenError(errorMessage);
    } finally {
      setIsShortening(false);
    }
  }, [editedPrompt, imagePrompt]);

  const handleRegenerate = useCallback(async () => {
    if (!frame?.id || !frame?.sequenceId) return;

    setIsRegenerating(true);

    // Optimistic update for frame list query
    queryClient.setQueryData<Frame[]>(
      ['frames', frame.sequenceId],
      (oldFrames) => {
        if (!oldFrames) return oldFrames;
        return oldFrames.map((f) =>
          f.id === frame.id
            ? {
                ...f,
                thumbnailStatus: 'generating' as const,
                imagePrompt: editedPrompt || f.imagePrompt,
                imageModel: selectedModel || f.imageModel,
              }
            : f
        );
      }
    );

    // Optimistic update for individual frame query
    queryClient.setQueryData<Frame>(['frame', frame.id], (oldFrame) => {
      if (!oldFrame) return oldFrame;
      return {
        ...oldFrame,
        thumbnailStatus: 'generating' as const,
        imagePrompt: editedPrompt || oldFrame.imagePrompt,
        imageModel: selectedModel || oldFrame.imageModel,
      };
    });

    try {
      const response = await fetch(
        `/api/sequences/${frame.sequenceId}/frames/${frame.id}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            prompt: editedPrompt || undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to regenerate image');
      }

      // Don't invalidate immediately - let auto-polling pick up server updates
      // The optimistic update shows 'generating' instantly, and the workflow
      // will update the server status which auto-polling will detect
    } catch (error) {
      console.error('Failed to regenerate image:', error);

      // Rollback on error - set status to failed
      await queryClient.invalidateQueries({
        queryKey: ['frames', frame.sequenceId],
      });
      await queryClient.invalidateQueries({ queryKey: ['frame', frame.id] });

      // Only clear isRegenerating on error - on success, let thumbnailStatus drive the loading state
      setIsRegenerating(false);
    }
  }, [frame, selectedModel, editedPrompt, queryClient]);

  // Update local state when frame image prompt changes
  useEffect(() => {
    setEditedPrompt(imagePrompt || '');
  }, [imagePrompt]);

  // Update local state when frame changes
  useEffect(() => {
    const currentModel =
      (frame?.imageModel as TextToImageModel) || DEFAULT_IMAGE_MODEL;
    setSelectedModel(currentModel);
  }, [frame?.imageModel]);

  // Clear isRegenerating once the optimistic update is reflected in frame status
  useEffect(() => {
    if (frame?.thumbnailStatus === 'generating' && isRegenerating) {
      setIsRegenerating(false);
    }
  }, [frame?.thumbnailStatus, isRegenerating]);

  const motionPrompt = frame?.metadata?.prompts?.motion?.fullPrompt;

  // Check if image is currently generating
  const isGenerating =
    frame?.thumbnailStatus === 'generating' || isRegenerating;

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => onTabChange(value as TabValue)}
      className="w-full"
    >
      <TabsList>
        <TabsTrigger value="script">Script</TabsTrigger>
        <TabsTrigger value="image-prompt">Image</TabsTrigger>
        <TabsTrigger value="motion-prompt">Motion</TabsTrigger>
      </TabsList>

      <TabsContent value="script">
        <PromptTabContent
          text={scriptText}
          isCopied={copiedTab === 'script'}
          onCopy={() => handleCopy(scriptText, 'script')}
          showDuration={true}
          durationMs={frame?.durationMs}
        />
      </TabsContent>

      <TabsContent value="image-prompt">
        <div className="space-y-4">
          {/* Error/Success Messages */}
          {shortenError && (
            <Alert variant="destructive">
              <AlertDescription>{shortenError}</AlertDescription>
            </Alert>
          )}

          {shortenSuccess && (
            <Alert>
              <AlertDescription>{shortenSuccess}</AlertDescription>
            </Alert>
          )}

          {/* Editable prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Prompt</label>
              <span className="text-xs text-muted-foreground">
                {(editedPrompt || imagePrompt || '').length} characters
              </span>
            </div>
            <Textarea
              value={editedPrompt || imagePrompt || ''}
              onChange={(e) => setEditedPrompt(e.target.value)}
              placeholder="Enter image prompt…"
              className="min-h-[120px] resize-y"
              disabled={isGenerating}
            />
          </div>

          {/* Model selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <ImageModelSelector
              selectedModel={selectedModel || imageModel}
              onModelChange={setSelectedModel}
              disabled={isGenerating}
              promptLength={(editedPrompt || imagePrompt || '').length}
            />
          </div>

          {/* Shorten button */}
          <Button
            variant="outline"
            onClick={handleShortenPrompt}
            disabled={
              isShortening ||
              isGenerating ||
              !editedPrompt ||
              editedPrompt.length < 20
            }
            className="w-full"
          >
            {isShortening && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!isShortening && <Minimize2 className="mr-2 h-4 w-4" />}
            {isShortening ? 'Shortening…' : 'Shorten Prompt'}
          </Button>

          {/* Regenerate button */}
          <Button
            onClick={handleRegenerate}
            disabled={isGenerating || !frame}
            className="w-full"
          >
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isGenerating ? 'Generating…' : 'Regenerate Image'}
          </Button>

          {/* Copy button for current prompt */}
          <Button
            variant="outline"
            onClick={() =>
              handleCopy(editedPrompt || imagePrompt, 'image-prompt')
            }
            disabled={!imagePrompt}
            className="w-full"
          >
            {copiedTab === 'image-prompt' ? (
              <span className="flex items-center gap-2">
                <span className="text-xs">✓</span> Copied
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CopyIcon className="h-4 w-4" /> Copy Prompt
              </span>
            )}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="motion-prompt">
        <PromptTabContent
          text={motionPrompt}
          isCopied={copiedTab === 'motion-prompt'}
          onCopy={() => handleCopy(motionPrompt, 'motion-prompt')}
        />
      </TabsContent>
    </Tabs>
  );
};
