/**
 * Login Page
 * Email OTP and Google OAuth authentication
 */

import { AuthForm } from '@/components/auth/auth-form';
import { PageContainer } from '@/components/layout/page-container';
import { getRedirectFromParams } from '@/lib/auth/navigation';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z.object({
  redirectTo: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute('/_auth/login')({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const redirectTo = getRedirectFromParams(search);
  const email = search.email || '';

  return (
    <PageContainer>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Sign In</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to continue creating cinematic content
            </p>
          </div>
          <AuthForm emailEntered={email} redirectTo={redirectTo} />
        </div>
      </div>
    </PageContainer>
  );
}
