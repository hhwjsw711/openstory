'use client';

import { GenerateSequenceIcon } from '@/components/icons/generate-sequence-icon';
import { AspectRatioSelect } from '@/components/style/aspect-ratio-select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_ANALYSIS_MODEL,
  type AnalysisModelId,
} from '@/lib/ai/models.config';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import Image from 'next/image';
import { useState } from 'react';
import { ModelSelector } from '../model/model-selector';

type SelectedStyle = {
  id: string;
  name: string;
  previewUrl: string | null;
};

type ScriptPromptProps = {
  onGenerate?: (
    script: string,
    aspectRatio: AspectRatio,
    models: AnalysisModelId[]
  ) => void;
  selectedStyle?: SelectedStyle | null;
  onStyleClick?: () => void;
};

export const ScriptPrompt: React.FC<ScriptPromptProps> = ({
  onGenerate,
  selectedStyle,
  onStyleClick,
}) => {
  const [script, setScript] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [selectedModels, setSelectedModels] = useState<AnalysisModelId[]>([
    DEFAULT_ANALYSIS_MODEL,
  ]);

  const handleSubmit = () => {
    if (script.trim() && onGenerate) {
      onGenerate(script, aspectRatio, selectedModels);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Film grain overlay effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.015] mix-blend-overlay">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
      </div>

      {/* Main prompt container */}
      <div className="relative bg-linear-to-br from-card via-background to-card rounded-2xl border border-border/50 shadow-2xl overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary/30 to-transparent" />

        {/* Control bar */}
        <div className="relative flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-card/40">
          <AspectRatioSelect value={aspectRatio} onChange={setAspectRatio} />

          <ModelSelector
            selectedModels={selectedModels}
            onModelsChange={setSelectedModels}
            singleSelect
          />

          <div className="flex-1" />

          {/* Style Selector */}
          {selectedStyle && (
            <button
              onClick={onStyleClick}
              className="relative size-10 rounded-lg overflow-hidden border-2 border-primary/30 hover:border-primary/60 transition-all hover:scale-105 hover:shadow-[0_0_0_3px] hover:shadow-primary/10 bg-card"
              title={`Style: ${selectedStyle.name}`}
            >
              {selectedStyle.previewUrl ? (
                <Image
                  src={selectedStyle.previewUrl}
                  alt={selectedStyle.name}
                  fill
                  className="object-cover"
                  sizes="120px"
                />
              ) : (
                <div className="size-full bg-linear-to-br from-muted to-muted-foreground/20" />
              )}
              <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-linear-to-t from-black/90 via-black/60 to-transparent">
                <p className="text-[10px] font-semibold text-white text-center uppercase tracking-wider line-clamp-1">
                  {selectedStyle.name}
                </p>
              </div>
            </button>
          )}
        </div>

        {/* Textarea area */}
        <div className="relative p-6">
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your sequence… Write a script, outline scenes, or paste your screenplay."
            className="min-h-[200px] bg-transparent dark:bg-transparent border-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none text-[15px] leading-relaxed font-light tracking-wide placeholder:text-muted-foreground"
          />

          {/* Bottom action bar */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
            <div className="flex items-center gap-4">
              {script.length > 0 && (
                <span className="text-xs text-muted-foreground font-mono">
                  {script.length} characters
                </span>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">
                  ⌘
                </kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">
                  Enter
                </kbd>
                <span>to generate</span>
              </span>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!script.trim()}
              className="group relative px-6 py-2.5 bg-linear-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold tracking-wide shadow-lg shadow-primary/20 hover:shadow-primary/30 overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                <GenerateSequenceIcon className="size-4" />
                Generate Sequence
              </span>
              {/* Shine effect */}
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
            </Button>
          </div>
        </div>

        {/* Bottom accent glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-linear-to-r from-transparent via-primary/20 to-transparent" />
      </div>
    </div>
  );
};
