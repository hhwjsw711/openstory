'use client';
import { AppLayout } from '@/components/layout';
import { useSession } from '@/lib/auth/client';
import { redirect } from 'next/navigation';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return redirect('/login');
  }

  return <AppLayout>{children}</AppLayout>;
}
