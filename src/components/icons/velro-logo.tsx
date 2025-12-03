import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const velroLogoVariants = cva('', {
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

export interface VelroLogoProps
  extends
    React.SVGProps<SVGSVGElement>,
    VariantProps<typeof velroLogoVariants> {}

export const VelroLogo: React.FC<VelroLogoProps> = ({
  className,
  size,
  ...props
}) => {
  return (
    <svg
      className={cn(velroLogoVariants({ size }), 'w-auto', className)}
      viewBox="0 0 379 75"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Velro"
      role="img"
      {...props}
    >
      <path
        d="M341.467 74.8C320.767 74.8 304.867 58.6 304.867 37.3C304.867 16 320.767 0 341.467 0C362.267 0 378.167 16 378.167 37.3C378.167 58.6 362.267 74.8 341.467 74.8ZM341.467 62.3C355.667 62.3 364.667 51.2 364.667 37.3C364.667 23.5 355.667 12.5 341.467 12.5C327.367 12.5 318.367 23.5 318.367 37.3C318.367 51.2 327.367 62.3 341.467 62.3Z"
        fill="currentColor"
      />
      <path
        d="M259.13 49.0996H246.73V73.2996H233.43V1.09961H259.13C275.83 1.09961 286.63 9.99961 286.63 24.9996C286.63 35.2996 281.83 42.3996 273.73 46.2996C273.33 46.3996 272.93 46.5996 272.63 46.6996L290.03 73.2996H274.63L259.33 49.0996H259.13ZM260.03 12.8996H246.73V36.8996H260.03C267.53 36.8996 273.23 32.4996 273.23 24.4996C273.23 16.9996 267.93 12.8996 260.03 12.8996Z"
        fill="currentColor"
      />
      <path
        d="M209.891 60.9V73.3H164.891V1.5H178.191V60.9H209.891Z"
        fill="currentColor"
      />
      <path
        d="M102.331 60.9H139.831V73.3H89.1309V1.5H139.831V13.9H102.331L102.231 31.2H139.831V43.6H102.231L102.331 60.9Z"
        fill="currentColor"
      />
      <path
        d="M53.1 1.5H66.6L40.4 73.3H26.1L0 1.5H14.4L33.6 56.9L53.1 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
};
