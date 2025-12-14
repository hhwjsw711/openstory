import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

const pageHeadingVariants = cva('font-bold tracking-tight', {
  variants: {
    size: {
      small: 'text-2xl',
      medium: 'text-3xl',
      large: 'text-4xl',
      hero: 'text-4xl sm:text-6xl',
    },
  },
  defaultVariants: {
    size: 'medium',
  },
});

const skeletonSizes = {
  small: 'h-8 w-[180px]',
  medium: 'h-9 w-[220px]',
  large: 'h-10 w-[280px]',
  hero: 'h-10 sm:h-14 w-[320px] sm:w-[480px]',
} as const;

interface PageHeadingProps
  extends
    React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof pageHeadingVariants> {
  as?: 'h1' | 'h2' | 'h3';
}

export const PageHeading: React.FC<PageHeadingProps> = ({
  className,
  size,
  as: Component = 'h1',
  children,
  ...props
}) => {
  const effectiveSize = size ?? 'medium';

  return (
    <Component
      className={cn(pageHeadingVariants({ size }), className)}
      {...props}
    >
      {children ?? <Skeleton className={skeletonSizes[effectiveSize]} />}
    </Component>
  );
};
