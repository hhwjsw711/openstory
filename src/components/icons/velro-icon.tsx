import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const velroIconVariants = cva('', {
  variants: {
    size: {
      xs: 'w-4 h-4',
      sm: 'w-6 h-6',
      md: 'w-8 h-8',
      lg: 'w-12 h-12',
      xl: 'w-16 h-16',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface VelroIconProps
  extends React.SVGProps<SVGSVGElement>,
    VariantProps<typeof velroIconVariants> {}

export const VelroIcon: React.FC<VelroIconProps> = ({
  className,
  size,
  ...props
}) => {
  return (
    <svg
      className={cn(velroIconVariants({ size }), className)}
      viewBox="0 0 1000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Velro"
      role="img"
      {...props}
    >
      <rect width="1000" height="1000" rx="10" fill="currentColor" />
      <path
        d="M737.838 69H900L585.285 931.462H413.514L100 69H272.973L503.604 734.465L737.838 69Z"
        fill="white"
        className="dark:fill-black"
      />
    </svg>
  );
};
