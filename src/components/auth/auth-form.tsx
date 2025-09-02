import type * as React from "react";
import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

export const AuthForm: React.FC<AuthFormProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <CardContent className={cn("space-y-6", className)} {...props}>
      {children}
    </CardContent>
  );
};
