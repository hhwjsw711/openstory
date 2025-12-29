import { AppLayout } from '@/components/layout/app-layout';
import { createFileRoute, Outlet } from '@tanstack/react-router';
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
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
