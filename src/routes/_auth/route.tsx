/**
 * Auth Layout
 * Layout for authentication pages (login, verify)
 */

import { RouteErrorFallback } from '@/components/error/route-error-fallback';
import { sessionQueryOptions } from '@/lib/auth/session-query';
import { getIsPreviewFn } from '@/lib/utils/environment';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
  errorComponent: (props) => (
    <RouteErrorFallback {...props} heading="Authentication error" />
  ),
  beforeLoad: async ({ context: { queryClient } }) => {
    const session = await queryClient.ensureQueryData(sessionQueryOptions);
    if (session?.user) {
      throw redirect({ to: '/' });
    }

    const isPreview = await getIsPreviewFn();
    return { isPreview };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <Outlet />
    </div>
  );
}
