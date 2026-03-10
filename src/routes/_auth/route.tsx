/**
 * Auth Layout
 * Layout for authentication pages (login, verify)
 */

import { RouteErrorFallback } from '@/components/error/route-error-fallback';
import { getIsPreviewFn } from '@/lib/utils/environment';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
  errorComponent: (props) => (
    <RouteErrorFallback {...props} heading="Authentication error" />
  ),
  beforeLoad: async ({ context: { user } }) => {
    if (user) {
      throw redirect({ to: '/' });
    }

    const isPreview = await getIsPreviewFn();
    console.log('isPreview in beforeLoad', isPreview);
    return { isPreview };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
