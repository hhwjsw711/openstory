'use client';
import { AppLayout } from '@/components/layout';
import { useSession } from '@/lib/auth/client';
import { redirect, usePathname } from 'next/navigation';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const pathname = usePathname();

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    redirect('/login');
  }

  // Check if user has pending status and needs to enter invite code
  const user = session.user as typeof session.user & { status?: string };
  if (user.status === 'pending') {
    redirect('/invite-code?redirectTo=' + encodeURIComponent(pathname));
  }

  // Check if user is suspended
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

  return <AppLayout>{children}</AppLayout>;
}
