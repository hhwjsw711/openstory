import { AppLayout } from '@/components/layout/app-layout';
import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { redirect } from '@tanstack/react-router';
import { getSessionFn } from '@/lib/auth/server';

export const Route = createFileRoute('/_protected')({
  component: ProtectedLayout,
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) {
      throw redirect({
        to: '/login',
      });
    }

    if (
      session.user.status === 'pending' ||
      session.user.status === 'suspended'
    ) {
      throw redirect({
        to: '/invite-code',
      });
    }
  },
});

function ProtectedLayout() {
  const location = useLocation();
  const isSettingsPage = location.pathname.startsWith('/settings');

  return (
    <AppLayout
      className={
        isSettingsPage ? 'overflow-y-auto [scrollbar-gutter:stable]' : undefined
      }
    >
      <Outlet />
    </AppLayout>
  );
}
