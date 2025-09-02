import type * as React from "react";
import { cn } from "@/lib/utils";

export interface AuthContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const AuthContainer: React.FC<AuthContainerProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "min-h-screen flex items-center justify-center bg-background px-4 py-12",
        className,
      )}
      {...props}
    >
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
};
