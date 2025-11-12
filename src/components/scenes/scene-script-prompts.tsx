import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Frame } from '@/types/database';
import { CopyIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

type SceneScriptPromptsProps = {
  frame?: Frame | undefined;
};

export const SceneScriptPrompts: React.FC<SceneScriptPromptsProps> = ({
  frame,
}) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const handleCopy = useCallback(
    async (text: string | undefined | null, tabName: string) => {
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        setCopiedTab(tabName);
        setTimeout(() => setCopiedTab(null), 2000);
        return true;
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
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
                <CopyIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="prose prose-sm max-w-none pr-10">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {scriptText || 'No script available'}
            </p>
          </div>
        </div>
        {frame &&
          frame.durationMs !== undefined &&
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
                <CopyIcon className="h-4 w-4" />
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
                <CopyIcon className="h-4 w-4" />
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
  );
};
