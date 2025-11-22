'use client';
import { AppLayout } from '@/components/layout';
import { useSession } from '@/lib/auth/client';
import { redirect, useRouter } from 'next/navigation';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  return <AppLayout>{children}</AppLayout>;
}
