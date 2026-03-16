/**
 * Remotion component that plays a frame's video,
 * scaled to fill the composition.
 */

import { OffthreadVideo } from 'remotion';

type FrameVideoProps = {
  src: string;
};

export const FrameVideo: React.FC<FrameVideoProps> = ({ src }) => {
  return (
    <OffthreadVideo
      src={src}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
};
