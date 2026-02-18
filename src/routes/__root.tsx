import appCss from '@/styles/global.css?url';
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Link,
  useRouter,
} from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { Providers } from '@/components/providers';
import { Button } from '@/components/ui/button';

type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'description',
        content:
          'Transform scripts into consistent, styled video productions using multiple AI models.',
      },
      { title: 'AI Video Studio' },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/icon.svg',
      },
    ],
  }),
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
});

function RootLayout() {
  const { queryClient } = Route.useRouteContext();
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <Providers queryClient={queryClient}>
          <Outlet />
        </Providers>
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Button asChild>
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}

function ErrorBoundary({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md text-center">
        {error instanceof Error
          ? error.message
          : 'An unexpected error occurred'}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Try again
        </Button>
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
