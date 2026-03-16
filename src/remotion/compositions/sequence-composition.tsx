/**
 * SequenceComposition - Main Remotion composition that renders all frames
 * in order with optional crossfade transitions.
 *
 * This is the component passed to <Player component={SequenceComposition} />.
 */

import { FrameScene } from '@/remotion/compositions/frame-scene';
import {
  TRANSITION_DURATION_FRAMES,
  getFrameDurationInFrames,
  type SequenceCompositionProps,
} from '@/remotion/types';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

/**
 * Crossfade wrapper — fades a child in/out at sequence boundaries.
 */
const CrossfadeWrapper: React.FC<{
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [
      0,
      TRANSITION_DURATION_FRAMES,
      durationInFrames - TRANSITION_DURATION_FRAMES,
      durationInFrames,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const SequenceComposition: React.FC<SequenceCompositionProps> = ({
  frames,
  transition,
}) => {
  const { fps } = useVideoConfig();

  if (frames.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 18,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        No frames
      </AbsoluteFill>
    );
  }

  // Calculate start positions accounting for transition overlaps
  const useCrossfade = transition === 'crossfade' && frames.length > 1;
  const overlap = useCrossfade ? TRANSITION_DURATION_FRAMES : 0;

  let offset = 0;
  const entries = frames.map((frame, index) => {
    const duration = getFrameDurationInFrames(frame, fps);
    const startFrom = offset;
    offset += duration - overlap;

    return { frame, index, startFrom, duration };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {entries.map(({ frame, index, startFrom, duration }) => (
        <Sequence
          key={frame.id}
          from={startFrom}
          durationInFrames={duration}
          name={frame.metadata?.metadata?.title ?? `Scene ${index + 1}`}
        >
          {useCrossfade ? (
            <CrossfadeWrapper durationInFrames={duration}>
              <FrameScene frame={frame} />
            </CrossfadeWrapper>
          ) : (
            <FrameScene frame={frame} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
