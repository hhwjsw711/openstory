import { Providers } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { sessionQueryOptions } from '@/lib/auth/session-query';
import { getProductionDeploymentAppUrl } from '@/lib/utils/environment';
import appCss from '@/styles/global.css?url';
import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  redirect,
  Scripts,
  useRouter,
} from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';

type RouterContext = {
  queryClient: QueryClient;
};
const getCanonicalOriginFn = createIsomorphicFn().server(() => {
  const headers = getRequestHeaders();
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return null;

  const canonical = new URL(getProductionDeploymentAppUrl(headers));
  if (host === canonical.host) return null;
  return canonical.origin;
});

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    // This is to redirect from git origins to the hash origin on vercel preview branches
    const canonicalOrigin = getCanonicalOriginFn();
    if (canonicalOrigin) {
      throw redirect({ href: canonicalOrigin + location.href });
    }
    const sessionData = await queryClient.ensureQueryData(sessionQueryOptions);
    const { session, user } = sessionData ?? { session: null, user: null };

    return { session, user };
  },
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
      { title: 'OpenStory' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icon-192.png' },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      { rel: 'manifest', href: '/manifest.json' },
    ],
  }),
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
});

function RootLayout() {
  const { queryClient } = Route.useRouteContext();
  return (
    <html lang="en">
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
