import { AppLayout } from '@/components/layout';
import { useAuthNavigation } from '@/hooks/use-auth-navigation';
import { useSession } from '@/lib/auth/client';
import { useEffect } from 'react';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const { goToLogin } = useAuthNavigation();

  // Redirect to login if not authenticated (client-side check)
  useEffect(() => {
    if (!isPending && !session?.user) {
      goToLogin();
    }
  }, [session, isPending, goToLogin]);

  // Show loading state while checking session
  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Don't render children if not authenticated (redirect will happen)
  if (!session?.user) {
    return null;
  }

  return <AppLayout>{children}</AppLayout>;
}
