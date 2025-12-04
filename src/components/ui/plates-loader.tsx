import { cn } from '@/lib/utils';

type PlatesLoaderProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeConfig = {
  sm: {
    scene: 'w-16 h-16 [perspective:400px]',
    plate: 'w-10 h-10',
    stack: '[transform:rotateX(60deg)_rotateZ(45deg)_translateZ(-12px)]',
    gap: 10,
  },
  md: {
    scene: 'w-24 h-24 [perspective:500px]',
    plate: 'w-14 h-14',
    stack: '[transform:rotateX(60deg)_rotateZ(45deg)_translateZ(-16px)]',
    gap: 12,
  },
  lg: {
    scene: 'w-32 h-32 [perspective:600px]',
    plate: 'w-20 h-20',
    stack: '[transform:rotateX(60deg)_rotateZ(45deg)_translateZ(-20px)]',
    gap: 14,
  },
};

// Compact 3-plate stack
const PLATE_COUNT = 3;

export const PlatesLoader: React.FC<PlatesLoaderProps> = ({
  size = 'md',
  className,
}) => {
  const config = sizeConfig[size];

  return (
    <div className={cn('relative transform-3d', config.scene, className)}>
      <div className={cn('relative h-full w-full transform-3d', config.stack)}>
        {Array.from({ length: PLATE_COUNT }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md',
              'border border-white/40 transform-3d',
              'bg-linear-to-br from-orange-400/50 to-orange-900/90',
              'shadow-[inset_0_0_10px_rgba(251,146,60,0.5),0_3px_8px_rgba(0,0,0,0.5)]',
              'animate-[plates-wave_2.5s_ease-in-out_infinite] fill-mode-backwards',
              config.plate
            )}
            style={
              {
                '--base-z': `${i * config.gap}px`,
                animationDelay: `${i * 0.2}s`,
                zIndex: i,
              } as React.CSSProperties
            }
          >
            {/* Animated sheen */}
            <div
              className={cn(
                'absolute inset-0 rounded-[inherit] pointer-events-none',
                'bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.7)_45%,rgba(255,255,255,0.3)_55%,transparent_80%)]',
                'bg-size-[250%_250%] mix-blend-overlay',
                'animate-[plates-sheen_3s_ease-in-out_infinite]'
              )}
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          </div>
        ))}
      </div>
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
        'relative flex items-center justify-center overflow-hidden bg-zinc-950',
        className
      )}
    >
      {/* Amber glow gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.15),transparent_70%)]" />
      <PlatesLoader size={size} />
    </div>
  );
};
