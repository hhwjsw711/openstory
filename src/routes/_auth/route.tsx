/**
 * Auth Layout
 * Layout for authentication pages (login, verify)
 */

import { getIsPreviewFn } from '@/lib/utils/environment';
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const isPreview = await getIsPreviewFn();
    return { isPreview };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
