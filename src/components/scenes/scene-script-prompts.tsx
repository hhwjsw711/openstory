import { ImageModelSelector } from '@/components/model/image-model-selector';
import { MotionModelSelector } from '@/components/model/motion-model-selector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { shortenPromptFn } from '@/functions/ai';
import { generateFrameImageFn } from '@/functions/frame-image';
import { generateFrameMotionFn } from '@/functions/motion-functions';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  getCompatibleModel,
  safeImageToVideoModel,
  safeTextToImageModel,
  type ImageToVideoModel,
  type TextToImageModel,
} from '@/lib/ai/models';
import {
  type AspectRatio,
  aspectRatioToImageSize,
} from '@/lib/constants/aspect-ratios';
import type { Frame } from '@/types/database';
import { useQueryClient } from '@tanstack/react-query';
import { CopyIcon, Loader2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  useGenerateVariants,
  useSelectVariant,
  frameKeys,
} from '@/hooks/use-frames';
import { SceneCastTab } from './scene-cast-tab';
import { SceneLocationTab } from './scene-location-tab';
import { VariantSelector } from './variant-selector';

export type TabValue =
  | 'script'
  | 'image-prompt'
  | 'motion-prompt'
  | 'scene-variants'
  | 'cast'
  | 'location';

function isValidTabValue(value: string): value is TabValue {
  return (
    value === 'script' ||
    value === 'image-prompt' ||
    value === 'motion-prompt' ||
    value === 'scene-variants' ||
    value === 'cast' ||
    value === 'location'
  );
}

type SceneScriptPromptsProps = {
  frame?: Frame | undefined;
  sequenceId: string;
  selectedTab: TabValue;
  onTabChange: (tab: TabValue) => void;
  regeneratingImages: Set<string>;
  regeneratingMotion: Set<string>;
  regeneratingSceneVariants: Set<string>;
  onRegenerateStart: (
    frameId: string,
    type: 'image' | 'motion' | 'scene-variants'
  ) => void;
  aspectRatio?: AspectRatio;
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
  sequenceId,
  selectedTab,
  onTabChange,
  regeneratingImages,
  regeneratingMotion,
  regeneratingSceneVariants,
  onRegenerateStart,
  aspectRatio,
}) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [isShortening, setIsShortening] = useState(false);
  const [shortenError, setShortenError] = useState<string | null>(null);
  const [shortenSuccess, setShortenSuccess] = useState<string | null>(null);

  // Image regeneration state
  const [editedImagePrompt, setEditedImagePrompt] = useState<string>('');
  const [selectedImageModel, setSelectedImageModel] = useState<
    TextToImageModel | undefined
  >(undefined);

  // Motion regeneration state
  const [editedMotionPrompt, setEditedMotionPrompt] = useState<string>('');
  const [selectedMotionModel, setSelectedMotionModel] = useState<
    ImageToVideoModel | undefined
  >(undefined);

  const queryClient = useQueryClient();
  const generateVariants = useGenerateVariants();
  const selectVariant = useSelectVariant();

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
  const imageModel = safeTextToImageModel(
    frame?.imageModel,
    DEFAULT_IMAGE_MODEL
  );
  const imagePrompt =
    frame?.imagePrompt || frame?.metadata?.prompts?.visual?.fullPrompt;

  const handleShortenPrompt = useCallback(async () => {
    setShortenError(null);
    setShortenSuccess(null);

    const currentPrompt = editedImagePrompt || imagePrompt;
    if (!currentPrompt || currentPrompt.length < 20) {
      setShortenError('Prompt is too short to shorten');
      return;
    }

    setIsShortening(true);

    try {
      const result = await shortenPromptFn({ data: { prompt: currentPrompt } });

      setEditedImagePrompt(result.shortenedPrompt);
      setShortenSuccess(
        `Prompt shortened by ${result.reductionPercent}% (${result.originalLength} → ${result.shortenedLength} chars)`
      );
      // Clear success message after 5 seconds
      setTimeout(() => setShortenSuccess(null), 5000);
    } catch (error) {
      console.error('Failed to shorten prompt:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to shorten prompt';
      setShortenError(errorMessage);
    } finally {
      setIsShortening(false);
    }
  }, [editedImagePrompt, imagePrompt]);

  const handleRegenerate = useCallback(async () => {
    if (!frame?.id || !frame?.sequenceId) return;

    onRegenerateStart(frame.id, 'image');

    // Optimistic update for frame list query
    queryClient.setQueryData<Frame[]>(
      frameKeys.list(frame.sequenceId),
      (oldFrames) => {
        if (!oldFrames) return oldFrames;
        return oldFrames.map((f) =>
          f.id === frame.id
            ? {
                ...f,
                thumbnailStatus: 'generating' as const,
                imagePrompt: editedImagePrompt || f.imagePrompt,
                imageModel: selectedImageModel || f.imageModel,
              }
            : f
        );
      }
    );

    // Optimistic update for individual frame query
    queryClient.setQueryData<Frame>(frameKeys.detail(frame.id), (oldFrame) => {
      if (!oldFrame) return oldFrame;
      return {
        ...oldFrame,
        thumbnailStatus: 'generating' as const,
        imagePrompt: editedImagePrompt || oldFrame.imagePrompt,
        imageModel: selectedImageModel || oldFrame.imageModel,
      };
    });

    try {
      await generateFrameImageFn({
        data: {
          sequenceId: frame.sequenceId,
          frameId: frame.id,
          model: selectedImageModel,
          prompt: editedImagePrompt || undefined,
        },
      });

      // Don't invalidate immediately - let auto-polling pick up server updates
      // The optimistic update shows 'generating' instantly, and the workflow
      // will update the server status which auto-polling will detect
    } catch (error) {
      console.error('Failed to regenerate image:', error);

      // Rollback on error - set status to failed
      await queryClient.invalidateQueries({
        queryKey: frameKeys.list(frame.sequenceId),
      });
      await queryClient.invalidateQueries({
        queryKey: frameKeys.detail(frame.id),
      });
    }
  }, [
    frame,
    selectedImageModel,
    editedImagePrompt,
    queryClient,
    onRegenerateStart,
  ]);

  const handleRegenerateMotion = useCallback(async () => {
    if (!frame?.id || !frame?.sequenceId) return;

    onRegenerateStart(frame.id, 'motion');

    // Optimistic update for frame list query
    queryClient.setQueryData<Frame[]>(
      frameKeys.list(frame.sequenceId),
      (oldFrames) => {
        if (!oldFrames) return oldFrames;
        return oldFrames.map((f) =>
          f.id === frame.id
            ? {
                ...f,
                videoStatus: 'generating' as const,
                motionPrompt: editedMotionPrompt || f.motionPrompt,
                motionModel: selectedMotionModel || f.motionModel,
              }
            : f
        );
      }
    );

    // Optimistic update for individual frame query
    queryClient.setQueryData<Frame>(frameKeys.detail(frame.id), (oldFrame) => {
      if (!oldFrame) return oldFrame;
      return {
        ...oldFrame,
        videoStatus: 'generating' as const,
        motionPrompt: editedMotionPrompt || oldFrame.motionPrompt,
        motionModel: selectedMotionModel || oldFrame.motionModel,
      };
    });

    try {
      await generateFrameMotionFn({
        data: {
          sequenceId: frame.sequenceId,
          frameId: frame.id,
          model: selectedMotionModel,
          prompt: editedMotionPrompt || undefined,
        },
      });

      // Don't invalidate immediately - let auto-polling pick up server updates
    } catch (error) {
      console.error('Failed to regenerate motion:', error);

      // Rollback on error
      await queryClient.invalidateQueries({
        queryKey: frameKeys.list(frame.sequenceId),
      });
      await queryClient.invalidateQueries({
        queryKey: frameKeys.detail(frame.id),
      });
    }
  }, [
    frame,
    selectedMotionModel,
    editedMotionPrompt,
    queryClient,
    onRegenerateStart,
  ]);

  const handleGenerateSceneVariants = useCallback(async () => {
    if (!frame?.id || !frame?.sequenceId) return;

    onRegenerateStart(frame.id, 'scene-variants');

    try {
      await generateVariants.mutateAsync({
        sequenceId: frame.sequenceId,
        frameId: frame.id,
        model: selectedImageModel,
        imageSize: aspectRatio
          ? aspectRatioToImageSize(aspectRatio)
          : undefined,
      });
    } catch (error) {
      console.error('Failed to generate scene variants:', error);
      // Error handling is done by the mutation hook
    }
  }, [
    frame,
    generateVariants,
    selectedImageModel,
    aspectRatio,
    onRegenerateStart,
  ]);

  const handleVariantSelect = useCallback(
    async (index: number) => {
      if (!frame?.id || !frame?.sequenceId) return;
      console.log('handleVariantSelect', index);
      try {
        await selectVariant.mutateAsync({
          sequenceId: frame.sequenceId,
          frameId: frame.id,
          variantIndex: index,
        });
      } catch (error) {
        console.error('Failed to select variant:', error);
        // Error handling is done by the mutation hook
      }
    },
    [frame, selectVariant]
  );

  // Update local state when frame image prompt changes
  useEffect(() => {
    setEditedImagePrompt(imagePrompt || '');
  }, [imagePrompt]);

  // Update local state when frame image model changes
  useEffect(() => {
    const currentModel = safeTextToImageModel(
      frame?.imageModel,
      DEFAULT_IMAGE_MODEL
    );
    setSelectedImageModel(currentModel);
  }, [frame?.imageModel]);

  const motionPrompt =
    frame?.motionPrompt || frame?.metadata?.prompts?.motion?.fullPrompt;

  // Update local state when frame motion prompt changes
  useEffect(() => {
    setEditedMotionPrompt(motionPrompt || '');
  }, [motionPrompt]);

  // Update local motion model state when frame or aspect ratio changes
  // Ensure the model is compatible with the aspect ratio
  useEffect(() => {
    const currentModel = frame?.motionModel
      ? safeImageToVideoModel(frame.motionModel)
      : DEFAULT_VIDEO_MODEL;
    const compatibleModel = aspectRatio
      ? getCompatibleModel(currentModel, aspectRatio)
      : currentModel;
    setSelectedMotionModel(compatibleModel);
  }, [frame?.motionModel, aspectRatio]);

  // Check if image is currently generating
  const isGenerating =
    frame?.thumbnailStatus === 'generating' ||
    (frame?.id ? regeneratingImages.has(frame.id) : false);

  // Check if motion is currently generating
  const isGeneratingMotion =
    frame?.videoStatus === 'generating' ||
    (frame?.id ? regeneratingMotion.has(frame.id) : false);

  const isGeneratingSceneVariants =
    frame?.variantImageStatus === 'generating' ||
    (frame?.id ? regeneratingSceneVariants.has(frame.id) : false);

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => {
        if (isValidTabValue(value)) {
          onTabChange(value);
        }
      }}
      className="w-full"
    >
      <TabsList>
        <TabsTrigger value="script">Script</TabsTrigger>
        <TabsTrigger value="cast">Cast</TabsTrigger>
        <TabsTrigger value="location">Location</TabsTrigger>
        <TabsTrigger value="image-prompt">Image</TabsTrigger>
        <TabsTrigger value="motion-prompt">Motion</TabsTrigger>
        <TabsTrigger value="scene-variants">Variants</TabsTrigger>
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
                {(editedImagePrompt || imagePrompt || '').length} characters
              </span>
            </div>
            <Textarea
              value={editedImagePrompt || imagePrompt || ''}
              onChange={(e) => setEditedImagePrompt(e.target.value)}
              placeholder={
                isGenerating
                  ? 'Prompt is being generated…'
                  : 'Enter image prompt…'
              }
              className="min-h-[120px] resize-y"
              disabled={isGenerating}
            />
          </div>

          {/* Model selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <ImageModelSelector
              selectedModel={selectedImageModel || imageModel}
              onModelChange={setSelectedImageModel}
              disabled={isGenerating}
            />
          </div>

          {/* Shorten button */}
          <Button
            variant="outline"
            onClick={handleShortenPrompt}
            disabled={
              isShortening ||
              isGenerating ||
              !editedImagePrompt ||
              editedImagePrompt.length < 20
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
            {isGenerating
              ? 'Generating…'
              : frame?.thumbnailUrl
                ? 'Regenerate Image'
                : 'Generate Image'}
          </Button>

          {/* Copy button for current prompt */}
          <Button
            variant="outline"
            onClick={() =>
              handleCopy(editedImagePrompt || imagePrompt, 'image-prompt')
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
        <div className="space-y-4">
          {/* Editable motion prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Prompt</label>
              <span className="text-xs text-muted-foreground">
                {(editedMotionPrompt || motionPrompt || '').length} characters
              </span>
            </div>
            <Textarea
              value={editedMotionPrompt || motionPrompt || ''}
              onChange={(e) => setEditedMotionPrompt(e.target.value)}
              placeholder={
                isGeneratingMotion
                  ? 'Prompt is being generated…'
                  : 'Enter motion prompt…'
              }
              className="min-h-[120px] resize-y"
              disabled={isGenerating || isGeneratingMotion}
            />
          </div>

          {/* Model selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <MotionModelSelector
              selectedModel={selectedMotionModel || DEFAULT_VIDEO_MODEL}
              onModelChange={setSelectedMotionModel}
              disabled={isGenerating || isGeneratingMotion}
              aspectRatio={aspectRatio}
            />
          </div>

          {/* Regenerate button */}
          <Button
            onClick={handleRegenerateMotion}
            disabled={isGenerating || isGeneratingMotion || !frame}
            className="w-full"
          >
            {isGeneratingMotion && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isGeneratingMotion
              ? 'Generating…'
              : frame?.videoUrl
                ? 'Regenerate Motion'
                : 'Generate Motion'}
          </Button>

          {/* Copy button for current prompt */}
          <Button
            variant="outline"
            onClick={() =>
              handleCopy(editedMotionPrompt || motionPrompt, 'motion-prompt')
            }
            disabled={!motionPrompt}
            className="w-full"
          >
            {copiedTab === 'motion-prompt' ? (
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

      <TabsContent value="scene-variants">
        <div className="space-y-4">
          {/* Variant Selector */}
          {frame?.variantImageUrl ? (
            <VariantSelector
              variantImageUrl={frame.variantImageUrl}
              selectedVariantIndex={null} // TODO: Store selected variant index in frame metadata if needed
              onVariantSelect={handleVariantSelect}
              loading={isGeneratingSceneVariants || selectVariant.isPending}
              disabled={isGeneratingSceneVariants || selectVariant.isPending}
              aspectRatio={aspectRatio}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center text-sm text-muted-foreground">
              No variant image available. Generate variants to see options.
            </div>
          )}

          {/* Model selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <ImageModelSelector
              selectedModel={selectedImageModel || imageModel}
              onModelChange={setSelectedImageModel}
              disabled={isGenerating || isGeneratingSceneVariants}
            />
          </div>

          {/* Regenerate button */}
          <Button
            onClick={handleGenerateSceneVariants}
            disabled={
              isGenerating ||
              isGeneratingSceneVariants ||
              generateVariants.isPending ||
              !frame
            }
            className="w-full"
          >
            {(isGeneratingSceneVariants || generateVariants.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isGeneratingSceneVariants || generateVariants.isPending
              ? 'Generating…'
              : frame?.variantImageUrl
                ? 'Regenerate Scene Variants'
                : 'Generate Scene Variants'}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="cast">
        <SceneCastTab frame={frame} sequenceId={sequenceId} />
      </TabsContent>

      <TabsContent value="location">
        <SceneLocationTab frame={frame} sequenceId={sequenceId} />
      </TabsContent>
    </Tabs>
  );
};
