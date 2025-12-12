'use client';
import { AppLayout } from '@/components/layout';
import { useSession } from '@/lib/auth/client';
import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/_protected')({
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { data: session, isPending } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !session) {
      void navigate({
        to: '/login',
        search: {
          redirectTo: location.href,
        },
        replace: true,
      });
      return;
    }

    if (!isPending && session) {
      const user = session.user as typeof session.user & { status?: string };

      // Check if user has pending status and needs to enter invite code
      if (user.status === 'pending') {
        void navigate({
          to: '/invite-code',
          search: {
            redirectTo: location.href,
          },
          replace: true,
        });
        return;
      }
    }
  }, [session, isPending, location.href, navigate]);

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null; // Redirect is handled in useEffect
  }

  // Check if user is suspended
  const user = session.user as typeof session.user & { status?: string };
  if (user.status === 'suspended') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Account Suspended</h1>
          <p className="mt-2 text-muted-foreground">
            Your account has been suspended. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
