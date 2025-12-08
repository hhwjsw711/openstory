import { cn } from '@/lib/utils';
import type * as React from 'react';
import { Header } from './header';

export interface AppLayoutProps extends React.HTMLAttributes<HTMLElement> {}

export const AppLayout: React.FC<AppLayoutProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className="flex flex-col h-dvh overflow-hidden sm:h-screen sm:overflow-auto bg-background">
      <Header className="shrink-0" />
      <main
        className={cn(
          'flex flex-col flex-1 min-h-0 overflow-hidden',
          className
        )}
        {...props}
      >
        {children}
      </main>
    </div>
  );
};
