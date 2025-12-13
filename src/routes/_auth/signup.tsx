/**
 * Signup Page
 * New user registration
 */

import { AuthForm } from '@/components/auth/auth-form';
import { PageContainer } from '@/components/layout';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z.object({
  redirectTo: z.string().optional(),
  access_code: z.string().optional(),
  code: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute('/_auth/signup')({
  validateSearch: searchSchema,
  component: SignupPage,
});

function SignupPage() {
  const search = Route.useSearch();
  const redirectTo = search.redirectTo || '/sequences';
  const accessCode = search.access_code || search.code || '';
  const email = search.email || '';

  return (
    <PageContainer>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            {accessCode ? (
              <>
                <h1 className="text-3xl font-bold">Welcome, VIP!</h1>
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
