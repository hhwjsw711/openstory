/**
 * FrameScene - Renders a single frame in the Remotion composition.
 * Displays video if available, falls back to image, then placeholder.
 */

import { FrameImage } from '@/remotion/components/frame-image';
import { FramePlaceholder } from '@/remotion/components/frame-placeholder';
import { FrameVideo } from '@/remotion/components/frame-video';
import type { RemotionFrameData } from '@/remotion/types';
import { AbsoluteFill } from 'remotion';

type FrameSceneProps = {
  frame: RemotionFrameData;
};

export const FrameScene: React.FC<FrameSceneProps> = ({ frame }) => {
  const hasVideo = frame.videoUrl && frame.videoStatus === 'completed';
  const hasImage = !!frame.thumbnailUrl;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {hasVideo && frame.videoUrl ? (
        <FrameVideo src={frame.videoUrl} />
      ) : hasImage && frame.thumbnailUrl ? (
        <FrameImage
          src={frame.thumbnailUrl}
          alt={frame.metadata?.metadata?.title}
        />
      ) : (
        <FramePlaceholder
          title={frame.metadata?.metadata?.title}
          sceneNumber={frame.metadata?.sceneNumber}
        />
      )}
    </AbsoluteFill>
  );
};
