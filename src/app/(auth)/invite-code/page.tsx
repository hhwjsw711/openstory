/**
 * Invite Code Entry Page
 * New users must enter a valid invite code to activate their account
 * Velro is in closed preview mode
 */

import { InviteCodeForm } from '@/components/auth/invite-code-form';
import { PageContainer } from '@/components/layout';
import { getRedirectFromParams } from '@/lib/auth/navigation';
import { getUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

type Props = {
  searchParams: Promise<{ redirectTo?: string }>;
};

export default async function InviteCodePage({ searchParams }: Props) {
  // Check if user is authenticated
  const user = await getUser();

  if (!user) {
    // Not authenticated, redirect to login
    redirect('/login');
  }

  // Check user status
  const status = (user as typeof user & { status?: string }).status;

  // If user is already active, redirect to app
  if (!status || status === 'active') {
    const params = await searchParams;
    const redirectTo = getRedirectFromParams(params);
    redirect(redirectTo);
  }

  // If user is suspended, show error (shouldn't happen, but handle it)
  if (status === 'suspended') {
    return (
      <PageContainer>
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="w-full max-w-md space-y-8 text-center">
            <h1 className="text-3xl font-bold">Account Suspended</h1>
            <p className="text-muted-foreground">
              Your account has been suspended. Please contact support.
            </p>
          </div>
        </div>
      </PageContainer>
    );
  }

  // User is pending, show invite code form
  const params = await searchParams;
  const redirectTo = getRedirectFromParams(params);

  return (
    <PageContainer>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold">Welcome to Velro! 🎬</h1>
            <p className="text-muted-foreground">
              We're currently in closed preview mode
            </p>
            <p className="text-sm text-muted-foreground">
              Enter your invite code to get started
            </p>
          </div>
          <InviteCodeForm redirectTo={redirectTo} />
          <div className="text-center text-sm text-muted-foreground">
            <p>Don't have an invite code?</p>
            <p className="mt-1">
              Contact us at{' '}
              <a
                href="mailto:hello@velro.ai"
                className="text-primary hover:underline"
              >
                hello@velro.ai
              </a>{' '}
              or join our waitlist at{' '}
              <a
                href="https://velro.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                velro.ai
              </a>
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
