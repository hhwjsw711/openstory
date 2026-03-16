/**
 * Remotion component that displays a frame's thumbnail image,
 * scaled to fill the composition.
 */

import { Img } from 'remotion';

type FrameImageProps = {
  src: string;
  alt?: string;
};

export const FrameImage: React.FC<FrameImageProps> = ({ src, alt }) => {
  return (
    <Img
      src={src}
      alt={alt ?? 'Frame'}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
};
