import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MOTION_ACCESS_DENIED_MESSAGE } from '@/constants';
import { useAuthNavigation } from '@/hooks/use-auth-navigation';
import { useEstimateImageCostByFal } from '@/hooks/use-fal-models';
import { cn } from '@/lib/utils';
import type { Frame, Style } from '@/types/database';
import { Copy, Play, Video } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type * as React from 'react';
import { useCallback, useRef, useState } from 'react';

interface ModelInfo {
  id: string;
  name: string;
  model: string;
  type: 'image' | 'video';
  cost?: number;
  costUnit?: string;
}

interface StoryboardFrameWithScriptProps {
  frame: Frame;
  isGeneratingPreview?: boolean;
  styleId?: string;
  onEdit?: (frameId: string) => void;
  onDelete?: (frameId: string) => void;
  onRegenerate?: (payload: Record<string, unknown>) => void;
  onFrameUpdate?: (frame: Frame) => void;
  falModels?: ModelInfo[];
  styles?: Style[];
}

export const StoryboardFrameWithScript: React.FC<
  StoryboardFrameWithScriptProps
> = ({
  frame,
  isGeneratingPreview = false,
  styleId,
  onEdit,
  onDelete,
  onRegenerate,
  onFrameUpdate,
  falModels,
}) => {
  // Extract script chunk from metadata or use description
  const metadata = frame.metadata as Record<string, unknown> | null;
  const scriptChunk = metadata?.scriptChunk as string | undefined;
  const displayScript = scriptChunk || frame.description;

  // Extract prompts from metadata
  const scene = metadata as {
    originalScript?: { extract?: string };
    prompts?: {
      visual?: { fullPrompt?: string };
      motion?: { fullPrompt?: string };
    };
  } | null;
  const scriptText = scene?.originalScript?.extract || displayScript;
  const imagePrompt = scene?.prompts?.visual?.fullPrompt;
  const motionPrompt = scene?.prompts?.motion?.fullPrompt;

  // Copy state management
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  // Handle copy to clipboard
  const handleCopy = useCallback(
    async (text: string | undefined | null, tabName: string) => {
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

  // Auth navigation for redirect preservation
  const { loginUrl } = useAuthNavigation();

  // Video playback state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isGeneratingMotion, setIsGeneratingMotion] = useState(false);
  const [motionError, setMotionError] = useState<string | null>(null);

  const hasVideo = Boolean(frame.videoUrl);
  const hasThumbnail = Boolean(frame.thumbnailUrl);

  // Check generation status from database fields
  const isThumbnailGenerating = frame.thumbnailStatus === 'generating';
  const isThumbnailPending = frame.thumbnailStatus === 'pending';
  const isVideoGenerating =
    frame.videoStatus === 'generating' || isGeneratingMotion;
  const isVideoPending = frame.videoStatus === 'pending';

  // Compute overlay state (priority: thumbnail > video)
  const overlayState = (() => {
    if (isThumbnailPending) {
      return { show: true, text: 'Queued for generation...', isPending: true };
    }
    if (isThumbnailGenerating) {
      return { show: true, text: 'Generating image...', isPending: false };
    }
    if (isVideoPending) {
      return { show: true, text: 'Queued for motion...', isPending: true };
    }
    if (isVideoGenerating) {
      return { show: true, text: 'Generating motion...', isPending: false };
    }
    return { show: false, text: '', isPending: false };
  })();

  console.log('[isVideoGenerating] isVideoGenerating', {
    frameVideoStatus: frame.videoStatus,
    isGeneratingMotion,
    isVideoGenerating,
  });
  // Image generation with selected model
  const [selectedModel, setSelectedModel] = useState<string | null>('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const estimateImageCostMutation = useEstimateImageCostByFal();

  // Handle video playback
  const handlePlay = useCallback(() => {
    console.log('[handlePlay] Called', {
      hasVideo,
      showVideo,
      isPlaying,
      videoUrl: frame.videoUrl,
    });

    if (!hasVideo) {
      console.log('[handlePlay] No video URL');
      return;
    }

    if (!showVideo) {
      console.log('[handlePlay] Showing video element');
      setShowVideo(true);
      // Wait for video to be rendered before playing
      setTimeout(() => {
        if (videoRef.current) {
          console.log('[handlePlay] Playing video');
          videoRef.current.play().catch((err) => {
            console.error('[handlePlay] Error playing video:', err);
          });
          setIsPlaying(true);
        } else {
          console.error('[handlePlay] Video ref is null after timeout');
        }
      }, 100);
    } else if (isPlaying) {
      console.log('[handlePlay] Pausing video');
      videoRef.current?.pause();
      setIsPlaying(false);
    } else {
      console.log('[handlePlay] Resuming video');
      videoRef.current?.play().catch((err) => {
        console.error('[handlePlay] Error resuming video:', err);
      });
      setIsPlaying(true);
    }
  }, [hasVideo, showVideo, isPlaying, frame.videoUrl]);

  // Handle video ended
  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    // Keep showing video so user can replay
  }, []);

  // Generate motion for the frame
  const handleGenerateMotion = useCallback(async () => {
    if (!styleId) {
      setMotionError('Style ID is required for motion generation');
      return;
    }

    setIsGeneratingMotion(true);
    setMotionError(null);

    try {
      const response = await fetch(
        `/api/sequences/${frame.sequenceId}/frames/${frame.id}/motion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'seedance_v1_pro',
            duration: 3,
            fps: 14,
            motionBucket: 127,
          }),
        }
      );

      if (!response.ok) {
        console.log('response', response);

        const error = await response.json();
        throw new Error(error.error || 'Failed to generate motion');
      }

      const result = await response.json();

      if (result.success && result.data?.workflowRunId) {
        // Motion generation started - optimistically update UI
        console.log('[handleGenerateMotion] Motion generation started', {
          workflowRunId: result.data.workflowRunId,
        });

        // Optimistically update frame to show generating state
        onFrameUpdate?.({
          ...frame,
          videoStatus: 'generating',
          videoWorkflowRunId: result.data.workflowRunId,
        });
      } else {
        console.log('result', result);
        setMotionError('Failed to generate motion');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unexpected error during motion generation';
      setMotionError(errorMessage);
    } finally {
      setIsGeneratingMotion(false);
    }
  }, [
    styleId,
    frame, // Optimistically update frame metadata to show generating state
    onFrameUpdate,
  ]);

  // Handle regeneration with selected model
  const handleGenerateWithSelectedModel = useCallback(async () => {
    if (!selectedModel) return;

    setIsRegenerating(true);
    try {
      const response = await fetch(
        `/api/sequences/${frame.sequenceId}/frames/${frame.id}/regenerate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: selectedModel,
          }),
        }
      );

      if (!response.ok) {
        console.log('response', response);
        const error = await response.json();
        throw new Error(error.message || 'Failed to regenerate frame');
      }

      const result = await response.json();

      if (result.success) {
        // Optimistically clear thumbnail to show loading state
        onFrameUpdate?.({
          ...frame,
          thumbnailUrl: null,
        });

        console.log('[handleGenerateWithSelectedModel] Regeneration started', {
          workflowRunId: result.data.workflowRunId,
        });
      }
    } catch (error) {
      console.error(
        '[handleGenerateWithSelectedModel] Regeneration failed',
        error
      );
    } finally {
      setIsRegenerating(false);
    }
  }, [frame, selectedModel, onFrameUpdate]);

  // check cost per frame with style
  const handleCheckCost = useCallback(async () => {
    if (!selectedModel) return;

    const result = await estimateImageCostMutation.mutateAsync({
      model: selectedModel,
      prompt: displayScript || '',
      extra_params: {
        frame_id: frame.id,
        sequenceId: frame.sequenceId,
      },
    });

    console.log('[handleCheckCost] Cost result:', result);
  }, [frame, selectedModel, displayScript, estimateImageCostMutation]);

  return (
    <div
      className="group relative flex gap-6 rounded-lg border bg-card p-6 transition-all hover:shadow-md"
      data-testid={`storyboard-frame-${frame.orderIndex}`}
    >
      {/* Frame number badge */}
      <div className="absolute -left-3 top-8 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {frame.orderIndex + 1}
      </div>

      {/* Script section with tabs - Left side */}
      <div className="flex-1 space-y-3">
        <Tabs defaultValue="script" className="w-full">
          <TabsList>
            <TabsTrigger value="script">Script</TabsTrigger>
            <TabsTrigger value="image-prompt">Image Prompt</TabsTrigger>
            <TabsTrigger value="motion-prompt">Motion Prompt</TabsTrigger>
          </TabsList>

          <TabsContent value="script" className="space-y-3">
            <div className="relative">
              <div className="absolute right-0 top-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(scriptText, 'script')}
                  disabled={!scriptText}
                  className="h-8 w-8 p-0"
                >
                  {copiedTab === 'script' ? (
                    <span className="text-xs">✓</span>
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="prose prose-sm max-w-none pr-10">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {scriptText || 'No script available'}
                </p>
              </div>
            </div>
            {frame.durationMs !== undefined &&
              frame.durationMs !== null &&
              frame.durationMs > 0 && (
                <div className="text-xs text-muted-foreground">
                  Duration: {(frame.durationMs / 1000).toFixed(1)}s
                </div>
              )}
          </TabsContent>

          <TabsContent value="image-prompt" className="space-y-3">
            <div className="relative">
              <div className="absolute right-0 top-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(imagePrompt, 'image-prompt')}
                  disabled={!imagePrompt}
                  className="h-8 w-8 p-0"
                >
                  {copiedTab === 'image-prompt' ? (
                    <span className="text-xs">✓</span>
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="prose prose-sm max-w-none pr-10">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {imagePrompt || 'No image prompt available'}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="motion-prompt" className="space-y-3">
            <div className="relative">
              <div className="absolute right-0 top-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(motionPrompt, 'motion-prompt')}
                  disabled={!motionPrompt}
                  className="h-8 w-8 p-0"
                >
                  {copiedTab === 'motion-prompt' ? (
                    <span className="text-xs">✓</span>
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="prose prose-sm max-w-none pr-10">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {motionPrompt || 'No motion prompt available'}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Divider */}
      <div className="w-px bg-border" />

      {/* Frame preview - Right side */}
      <div className="flex-1 space-y-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Generated Frame
        </div>

        {/* Frame image/video */}
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
          {/* Video element (hidden when not playing) */}
          {hasVideo && showVideo && (
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover z-10"
              src={frame.videoUrl || ''}
              poster={
                hasThumbnail ? frame.thumbnailUrl || undefined : undefined
              }
              onEnded={handleVideoEnded}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onError={(e) => {
                console.error('[Video] Error loading video:', e);
                console.error('[Video] URL:', frame.videoUrl);
              }}
              onLoadedMetadata={() => {
                console.log(
                  '[Video] Metadata loaded for frame',
                  frame.orderIndex
                );
              }}
              controls={false}
              playsInline
              muted
            />
          )}

          {/* Thumbnail image (shown when video not playing) */}
          {(!showVideo || !hasVideo) && hasThumbnail && (
            <Image
              src={frame.thumbnailUrl || ''}
              alt={`Frame ${frame.orderIndex + 1} preview`}
              className="h-full w-full object-cover"
              width={1920}
              height={1080}
            />
          )}

          {/* Play button overlay */}
          {hasVideo && (
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20',
                'h-12 w-12 rounded-full bg-black/60 text-white',
                'transition-opacity hover:bg-black/80',
                isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'
              )}
              onClick={handlePlay}
            >
              <Play className="h-5 w-5 ml-0.5" />
            </Button>
          )}

          {/* Generation status overlay */}
          {overlayState.show && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
              <div className="flex flex-col items-center gap-2 text-white">
                {overlayState.isPending ? (
                  <div className="h-6 w-6 rounded-full border-2 border-white/40 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-white/60" />
                  </div>
                ) : (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                )}
                <span className="text-xs [text-shadow:none]">
                  {overlayState.text}
                </span>
              </div>
            </div>
          )}

          {/* Video indicator badge */}
          {hasVideo && (
            <div className="absolute top-2 right-2 z-15">
              <div className="bg-black/60 text-white flex items-center gap-1 rounded px-1.5 py-0.5 backdrop-blur-sm">
                <Video className="h-3 w-3" />
                <span className="text-xs font-medium">Motion</span>
              </div>
            </div>
          )}
        </div>

        {/* Thumbnail error */}
        {frame.thumbnailError && frame.thumbnailStatus === 'failed' && (
          <div className="text-xs text-destructive mt-1">
            Image generation failed: {frame.thumbnailError}
          </div>
        )}

        {/* Motion error */}
        {(motionError ||
          (frame.videoError && frame.videoStatus === 'failed')) && (
          <div className="text-xs text-destructive mt-1">
            {motionError || frame.videoError}
            {motionError === MOTION_ACCESS_DENIED_MESSAGE && (
              <Link
                href={loginUrl}
                className="ml-2 underline text-primary hover:text-primary/80"
              >
                Sign in
              </Link>
            )}
          </div>
        )}

        {/* Action buttons - shown on hover */}
        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {!hasVideo && styleId && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateMotion}
              disabled={isVideoGenerating}
              className="flex-1"
            >
              {isVideoGenerating ? 'Generating...' : 'Generate Motion'}
            </Button>
          )}
          {hasVideo && (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePlay}
              className="flex-1"
            >
              {isPlaying ? 'Pause' : 'Play Video'}
            </Button>
          )}
          {onRegenerate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleGenerateWithSelectedModel()}
              className="flex-1"
              disabled={
                !selectedModel || isRegenerating || isThumbnailGenerating
              }
            >
              {isRegenerating || isGeneratingPreview || isThumbnailGenerating
                ? 'Generating...'
                : 'Regenerate Frame'}
            </Button>
          )}
          {onEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(frame.id)}
              className="flex-1"
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(frame.id)}
              className="flex-1"
            >
              Delete
            </Button>
          )}

          {
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => handleCheckCost()}
            >
              Check Cost
            </Button>
          }
        </div>

        {/* Select model */}
        {falModels && (
          <div className="opacity-0 transition-opacity group-hover:opacity-100">
            <div className="w-full flex-1 flex flex-col gap-2">
              <Select
                placeholder="Select Model"
                options={falModels.map((model) => ({
                  label: model.name,
                  value: model.id,
                }))}
                onChange={(value) => {
                  setSelectedModel(value);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
