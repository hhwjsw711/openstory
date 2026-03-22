import { AppLayout } from '@/components/layout/app-layout';
import { RouteErrorFallback } from '@/components/error/route-error-fallback';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { redirect } from '@tanstack/react-router';
import { sessionQueryOptions } from '@/lib/auth/session-query';

export const Route = createFileRoute('/_protected')({
  component: ProtectedLayout,
  errorComponent: RouteErrorFallback,
  beforeLoad: async ({ context: { queryClient } }) => {
    const session = await queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) {
      throw redirect({
        to: '/login',
      });
    }

    if (session.user.status === 'suspended') {
      throw redirect({
        to: '/login',
      });
    }
  },
});

function ProtectedLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
