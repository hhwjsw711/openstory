import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const openStoryLogoVariants = cva('', {
  variants: {
    size: {
      xs: 'h-3',
      sm: 'h-4',
      md: 'h-6',
      lg: 'h-8',
      xl: 'h-12',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

type OpenStoryLogoProps = React.SVGProps<SVGSVGElement> &
  VariantProps<typeof openStoryLogoVariants>;

export const OpenStoryLogo: React.FC<OpenStoryLogoProps> = ({
  className,
  size,
  ...props
}) => {
  return (
    <svg
      className={cn(openStoryLogoVariants({ size }), 'w-auto', className)}
      viewBox="0 0 400 75"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="OpenStory"
      role="img"
      {...props}
    >
      <text
        x="0"
        y="55"
        fill="currentColor"
        fontFamily="system-ui, sans-serif"
        fontSize="60"
        fontWeight="bold"
      >
        OpenStory
      </text>
    </svg>
  );
};
