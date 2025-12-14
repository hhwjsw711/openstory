import { cn } from '@/lib/utils';
import type * as React from 'react';
import { Header } from './header';

interface AppLayoutProps extends React.HTMLAttributes<HTMLElement> {}

export const AppLayout: React.FC<AppLayoutProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <main
        className={cn('flex flex-col flex-1 overflow-hidden', className)}
        {...props}
      >
        {children}
      </main>
    </div>
  );
};
