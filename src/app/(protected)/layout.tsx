import { AppLayout } from '@/components/layout';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
