import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Frame } from '@/types/database';
import { CopyIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

type SceneScriptPromptsProps = {
  frame?: Frame | undefined;
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
}) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

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

  const scriptText = frame?.metadata?.originalScript?.extract;
  const imagePrompt = frame?.metadata?.prompts?.visual?.fullPrompt;
  const motionPrompt = frame?.metadata?.prompts?.motion?.fullPrompt;

  return (
    <Tabs defaultValue="script" className="w-full overflow-hidden">
      <TabsList>
        <TabsTrigger value="script">Script</TabsTrigger>
        <TabsTrigger value="image-prompt">Image Prompt</TabsTrigger>
        <TabsTrigger value="motion-prompt">Motion Prompt</TabsTrigger>
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
        <PromptTabContent
          text={imagePrompt}
          isCopied={copiedTab === 'image-prompt'}
          onCopy={() => handleCopy(imagePrompt, 'image-prompt')}
        />
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
