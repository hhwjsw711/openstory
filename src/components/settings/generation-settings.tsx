'use client';

import { ImageModelSelector } from '@/components/model/image-model-selector';
import { ModelSelector } from '@/components/model/model-selector';
import { MotionModelSelector } from '@/components/model/motion-model-selector';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import type { ImageToVideoModel, TextToImageModel } from '@/lib/ai/models';
import type { AnalysisModelId } from '@/lib/ai/models.config';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import { useState, type FC } from 'react';
import { AspectRatioPills } from './aspect-ratio-pills';
import { GenerationSettingsTrigger } from './generation-settings-trigger';

type GenerationSettingsProps = {
  aspectRatio: AspectRatio;
  analysisModels: AnalysisModelId[];
  imageModel: TextToImageModel;
  motionModel: ImageToVideoModel;
  onAspectRatioChange: (value: AspectRatio) => void;
  onAnalysisModelsChange: (value: AnalysisModelId[]) => void;
  onImageModelChange: (value: TextToImageModel) => void;
  onMotionModelChange: (value: ImageToVideoModel) => void;
  disabled?: boolean;
  singleSelectAnalysis?: boolean;
};

export const GenerationSettings: FC<GenerationSettingsProps> = ({
  aspectRatio,
  analysisModels,
  imageModel,
  motionModel,
  onAspectRatioChange,
  onAnalysisModelsChange,
  onImageModelChange,
  onMotionModelChange,
  disabled = false,
  singleSelectAnalysis = false,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <GenerationSettingsTrigger aspectRatio={aspectRatio} />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="flex flex-col gap-4">
          {/* Aspect Ratio Section */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">
              Aspect Ratio
            </h3>
            <AspectRatioPills
              value={aspectRatio}
              onChange={onAspectRatioChange}
            />
          </section>

          <Separator />

          {/* Analysis Model Section */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">
              Analysis Model
            </h3>
            <ModelSelector
              selectedModels={analysisModels}
              onModelsChange={onAnalysisModelsChange}
              disabled={disabled}
              singleSelect={singleSelectAnalysis}
            />
          </section>

          <Separator />

          {/* Image Model Section */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">Image Model</h3>
            <ImageModelSelector
              selectedModel={imageModel}
              onModelChange={onImageModelChange}
              disabled={disabled}
            />
          </section>

          <Separator />

          {/* Motion Model Section */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">
              Motion Model
            </h3>
            <MotionModelSelector
              selectedModel={motionModel}
              onModelChange={onMotionModelChange}
              disabled={disabled}
            />
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
};
