'use client';

import { Button } from '@/components/ui/button';
import type { Style } from '@/types/database';
import { ChevronDown } from 'lucide-react';
import type { FC } from 'react';

type DnaSelectorButtonProps = {
  selectedStyle?: Style | null;
  onClick?: () => void;
  size?: 'default' | 'sm' | 'lg';
};

export const DnaSelectorButton: FC<DnaSelectorButtonProps> = ({
  selectedStyle,
  onClick,
  size = 'default',
}) => {
  const sizeClasses = {
    sm: 'h-12 px-3 text-sm',
    default: 'h-16 px-4 text-base',
    lg: 'h-20 px-5 text-lg',
  };

  const labelSizeClasses = {
    sm: 'text-xs',
    default: 'text-sm',
    lg: 'text-base',
  };

  const nameSizeClasses = {
    sm: 'text-base',
    default: 'text-2xl',
    lg: 'text-3xl',
  };

  const hoverScaleClasses = {
    sm: 'hover:scale-105',
    default: 'hover:scale-[1.03]',
    lg: 'hover:scale-[1.02]',
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={`relative overflow-hidden ${sizeClasses[size]} min-w-[200px] justify-start rounded-2xl border-2 border-background bg-background/95 backdrop-blur-sm shadow-lg transition-all duration-200 ${hoverScaleClasses[size]} hover:border-foreground/60 hover:shadow-xl`}
    >
      {/* Background thumbnail with overlay */}
      {selectedStyle?.previewUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${selectedStyle.previewUrl})` }}
          />
          {/* Subtle dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/20" />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 flex w-full items-center justify-between gap-3">
        <div className="flex flex-col items-start">
          {/* Selected style name */}
          {selectedStyle ? (
            <>
              <span
                className={`font-bold uppercase tracking-wide text-foreground ${nameSizeClasses[size]}`}
              >
                {selectedStyle.name}
              </span>
              {selectedStyle.category && (
                <span
                  className={`text-muted-foreground ${labelSizeClasses[size]}`}
                >
                  {selectedStyle.category}
                </span>
              )}
            </>
          ) : (
            <span className={`text-muted-foreground ${nameSizeClasses[size]}`}>
              Select Style
            </span>
          )}
        </div>

        {/* Chevron indicator */}
        <ChevronDown className="h-6 w-6 text-primary" />
      </div>
    </Button>
  );
};
