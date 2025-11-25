/**
 * Signup Page
 * New user registration
 */

import { AuthForm } from '@/components/auth/auth-form';
import { PageContainer } from '@/components/layout';

type Props = {
  searchParams: Promise<{
    redirectTo?: string;
    access_code?: string;
    code?: string;
    email?: string;
  }>;
};

export default async function SignupPage({ searchParams }: Props) {
  const params = await searchParams;
  const redirectTo = params.redirectTo || '/sequences';
  const accessCode = params.access_code || params.code || '';
  const email = params.email || '';
  return (
    <PageContainer>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            {accessCode ? (
              <>
                <h1 className="text-3xl font-bold">Welcome, VIP! 🌟</h1>
                <p className="mt-2 text-muted-foreground">
                  You've been invited to join Velro early access
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold">Create Your Account</h1>
                <p className="mt-2 text-muted-foreground">
                  Start creating cinematic content with AI
                </p>
              </>
            )}
          </div>
          <AuthForm
            mode="signup"
            emailEntered={email}
            redirectTo={redirectTo}
          />
        </div>
      </div>
    </PageContainer>
  );
}
