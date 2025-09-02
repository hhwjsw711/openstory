import type * as React from "react";
import { PageHeading } from "@/components/typography/page-heading";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AuthHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({
  className,
  title,
  description,
  titleClassName,
  descriptionClassName,
  ...props
}) => {
  return (
    <CardHeader className={cn("text-center", className)} {...props}>
      <CardTitle className={titleClassName}>
        <PageHeading size="large" className="text-center">
          {title}
        </PageHeading>
      </CardTitle>
      {description && (
        <CardDescription className={cn("text-center", descriptionClassName)}>
          {description}
        </CardDescription>
      )}
    </CardHeader>
  );
};
