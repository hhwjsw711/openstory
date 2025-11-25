/**
 * Login Page
 * Handles email/password and OAuth authentication
 */

import { AuthForm } from '@/components/auth/auth-form';
import { PageContainer } from '@/components/layout';
import { getRedirectFromParams } from '@/lib/auth/navigation';

type Props = {
  searchParams: Promise<{ redirectTo?: string; email?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const redirectTo = getRedirectFromParams(params);
  const email = params.email || '';
  return (
    <PageContainer>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Welcome to Velro</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to continue creating cinematic content
            </p>
          </div>
          <AuthForm
            mode="signin"
            emailEntered={email}
            redirectTo={redirectTo}
          />
        </div>
      </div>
    </PageContainer>
  );
}
