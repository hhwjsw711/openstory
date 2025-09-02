import type * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AuthCardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const AuthCard: React.FC<AuthCardProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <Card className={cn("w-full", className)} {...props}>
      {children}
    </Card>
  );
};
