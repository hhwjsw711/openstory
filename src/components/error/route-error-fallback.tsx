import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react';

type RouteErrorFallbackProps = ErrorComponentProps & {
  heading?: string;
};

export const RouteErrorFallback: React.FC<RouteErrorFallbackProps> = ({
  error,
  reset,
  heading = 'Something went wrong',
}) => {
  const router = useRouter();

  console.error(`[RouteError:${heading}]`, error);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Alert variant="destructive" className="max-w-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{heading}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>
            {error instanceof Error
              ? error.message
              : 'An unexpected error occurred'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => {
              reset();
              void router.invalidate();
            }}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
};
