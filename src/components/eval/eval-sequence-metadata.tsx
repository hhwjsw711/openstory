'use client';

import type React from 'react';
import Link from 'next/link';
import { AspectRatioIcon } from '@/components/icons/aspect-ratio-icon';
import { ModelBadge } from '@/components/model/model-badge';
import { getAspectRatioData } from '@/lib/constants/aspect-ratios';
import { formatDistanceToNow } from '@/lib/utils';
import { formatDuration } from '@/lib/utils/format-duration';
import { getImageModelById } from '@/lib/ai/models';
import { Calendar, Timer, ImageIcon, Workflow } from 'lucide-react';
import type { SequenceWithFrames } from '@/hooks/use-sequences-with-frames';

type EvalSequenceMetadataProps = {
  sequence: SequenceWithFrames;
};

export const EvalSequenceMetadata: React.FC<EvalSequenceMetadataProps> = ({
  sequence,
}) => {
  const ratioData = getAspectRatioData(sequence.aspectRatio);
  const imageModel = getImageModelById(sequence.imageModel);

  return (
    <div className="h-full border-r border-b p-3 flex flex-col gap-2">
      {/* Title */}
      <Link
        href={`/sequences/${sequence.id}/scenes`}
        className="font-medium text-sm line-clamp-2 hover:underline"
        title={sequence.title || 'Untitled Sequence'}
      >
        {sequence.title || 'Untitled Sequence'}
      </Link>

      {/* Analysis Model */}
      <ModelBadge model={sequence.analysisModel} />

      {/* Image Model */}
      {imageModel && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ImageIcon className="h-3 w-3" />
          <span className="truncate">{imageModel.name}</span>
        </div>
      )}

      {/* Workflow */}
      {sequence.workflow && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Workflow className="h-3 w-3" />
          <span className="truncate">{sequence.workflow}</span>
        </div>
      )}

      {/* Metadata Row */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {/* Created Date */}
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{formatDistanceToNow(new Date(sequence.createdAt))}</span>
        </div>

        {/* Analysis Duration */}
        {sequence.analysisDurationMs > 0 && (
          <div className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            <span>{formatDuration(sequence.analysisDurationMs)}</span>
          </div>
        )}

        {/* Aspect Ratio */}
        {ratioData && (
          <div className="flex items-center gap-1">
            <AspectRatioIcon
              width={ratioData.width}
              height={ratioData.height}
              size="sm"
            />
            <span>{ratioData.label}</span>
          </div>
        )}
      </div>

      {/* Frame Count */}
      <div className="text-xs text-muted-foreground">
        {sequence.frames.length} scene{sequence.frames.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};
