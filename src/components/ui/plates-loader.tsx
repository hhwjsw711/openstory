import { cn } from '@/lib/utils';

type PlatesLoaderProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeConfig = {
  sm: {
    scene: 'w-16 h-16',
    plate: 'w-8 h-8 rounded',
    gap: 10,
    offset: 30,
  },
  md: {
    scene: 'w-28 h-28',
    plate: 'w-14 h-14 rounded-md',
    gap: 14,
    offset: 42,
  },
  lg: {
    scene: 'w-40 h-40',
    plate: 'w-20 h-20 rounded-lg',
    gap: 20,
    offset: 60,
  },
};

// Reduced from 8 to 6 for better performance
const PLATE_COUNT = 6;

export const PlatesLoader: React.FC<PlatesLoaderProps> = ({
  size = 'md',
  className,
}) => {
  const config = sizeConfig[size];

  return (
    <div
      className={cn('relative', config.scene, className)}
      style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
    >
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(60deg) rotateZ(45deg) translateZ(-${config.offset}px)`,
        }}
      >
        {Array.from({ length: PLATE_COUNT }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
              config.plate
            )}
            style={
              {
                '--base-z': `${i * config.gap}px`,
                background:
                  'linear-gradient(135deg, rgba(251, 146, 60, 0.5) 0%, rgba(124, 45, 18, 0.85) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                transformStyle: 'preserve-3d',
                willChange: 'transform, opacity',
                animation: 'plates-wave 2.5s ease-in-out infinite',
                // Small base delay + stagger to let browser settle before animating
                animationDelay: `${0.1 + i * 0.12}s`,
                animationFillMode: 'backwards',
              } as React.CSSProperties
            }
          >
            {/* Static highlight - no animation */}
            <div
              className="absolute inset-0 rounded-[inherit] pointer-events-none"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.6)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            />
          </div>
        ))}
      </div>
      {/* Static ambient glow - no animation */}
      <div
        className="absolute top-[75%] left-1/2 rounded-full"
        style={{
          width: size === 'sm' ? '48px' : size === 'md' ? '72px' : '96px',
          height: size === 'sm' ? '24px' : size === 'md' ? '36px' : '48px',
          background:
            'radial-gradient(ellipse, rgba(251, 146, 60, 0.3) 0%, transparent 70%)',
          transform: 'translateX(-50%)',
        }}
      />
    </div>
  );
};

/**
 * Container with gradient background for the plates loader.
 * Use this instead of wrapping PlatesLoader with bg-muted.
 */
export const PlatesLoaderContainer: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className }) => {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        className
      )}
      style={{
        background:
          'radial-gradient(circle at 50% 40%, rgba(251, 146, 60, 0.15), transparent 70%)',
        backgroundColor: 'var(--muted)',
      }}
    >
      <PlatesLoader size={size} />
    </div>
  );
};
