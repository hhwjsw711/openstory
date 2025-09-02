import type * as React from "react";
import { cn } from "@/lib/utils";

export interface AppLayoutProps extends React.HTMLAttributes<HTMLElement> {}

export const AppLayout: React.FC<AppLayoutProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <main className={cn("min-h-screen bg-background", className)} {...props}>
      {children}
    </main>
  );
};
