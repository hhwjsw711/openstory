/**
 * Auth Layout
 * Layout for authentication pages (login, access code entry)
 */

import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
