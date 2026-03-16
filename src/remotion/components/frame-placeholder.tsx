/**
 * Placeholder shown in the Remotion composition when a frame
 * has no thumbnail or video yet (still generating).
 */

import { useCurrentFrame, useVideoConfig } from 'remotion';

type FramePlaceholderProps = {
  title?: string;
  sceneNumber?: number;
};

export const FramePlaceholder: React.FC<FramePlaceholderProps> = ({
  title,
  sceneNumber,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Subtle pulse animation
  const pulse = 0.6 + 0.4 * Math.sin((frame / fps) * Math.PI * 2);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a2e',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: `rgba(167, 112, 239, ${0.2 * pulse})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: `rgba(167, 112, 239, ${0.4 * pulse})`,
          }}
        />
      </div>
      {sceneNumber != null && (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: 14,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Scene {sceneNumber}
        </div>
      )}
      {title && (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 18,
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '60%',
            textAlign: 'center',
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          color: 'rgba(255, 255, 255, 0.3)',
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Generating…
      </div>
    </div>
  );
};
