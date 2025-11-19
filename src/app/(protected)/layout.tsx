import { AppLayout } from '@/components/layout';
import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect('/login');
  }

  return <AppLayout>{children}</AppLayout>;
}
