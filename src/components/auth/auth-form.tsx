/**
 * Authentication Form Component
 * Supports email/password and OAuth sign-in/sign-up
 */

'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth/client';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface AuthFormProps {
  mode: 'signin' | 'signup';
  emailEntered?: string;
  redirectTo?: string;
}

export function AuthForm({
  mode,
  emailEntered,
  redirectTo = '/sequences',
}: AuthFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(emailEntered || '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const title = isSignup ? 'Create Account' : 'Sign In';
  const description = isSignup
    ? 'Create a new account to get started'
    : 'Sign in to your account';

  // Enable Google Auth on all environments (handled by oAuthProxy on previews)
  const showGoogleAuth = true;

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (isSignup) {
        // Sign up flow
        const signUpResult = await authClient.signUp.email({
          email,
          password,
          name: email.split('@')[0], // Use email prefix as default name
          callbackURL: redirectTo,
        });

        if (signUpResult.error) {
          setError(signUpResult.error.message || 'Failed to create account');
          setIsLoading(false);
          return;
        }

        // Invalidate auth-related queries to fetch fresh user data
        await queryClient.invalidateQueries({ queryKey: ['current-user'] });
        await queryClient.invalidateQueries({ queryKey: ['session'] });

        // New users have status: 'pending' by default - redirect to invite code
        setSuccess('Account created! Please enter your invite code...');
        router.push(
          '/invite-code?redirectTo=' + encodeURIComponent(redirectTo)
        );
      } else {
        // Sign in flow
        const signInResult = await authClient.signIn.email({
          email,
          password,
          callbackURL: redirectTo,
        });

        if (signInResult.error) {
          setError(signInResult.error.message || 'Authentication failed');
          setIsLoading(false);
          return;
        }

        // Invalidate auth-related queries to fetch fresh user data
        await queryClient.invalidateQueries({ queryKey: ['current-user'] });
        await queryClient.invalidateQueries({ queryKey: ['session'] });

        setSuccess('Signed in! Redirecting...');
        router.push(redirectTo);
      }
    } catch (err) {
      console.error('[AuthForm] Error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: redirectTo,
        // Redirect new Google users to invite code page
        newUserCallbackURL:
          '/invite-code?redirectTo=' + encodeURIComponent(redirectTo),
      });
    } catch (err) {
      console.error('[AuthForm] Google sign-in error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to sign in with Google'
      );
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error/Success Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* OAuth Providers */}
        {showGoogleAuth && (
          <>
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <svg
                  className="mr-2 h-4 w-4"
                  viewBox="0 0 24 24"
                  aria-label="Google logo"
                >
                  <title>Google</title>
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>
          </>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleEmailPasswordAuth}>
          <div className="space-y-2 mb-4">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {!isSignup && (
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? 'Please wait...'
              : isSignup
                ? 'Create Account'
                : 'Sign In'}
          </Button>
        </form>

        {/* Navigation links */}
        <div className="text-center text-sm pt-4 border-t">
          {isSignup ? (
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link
                href={`/login?redirectTo=${encodeURIComponent(redirectTo)}${email ? `&email=${encodeURIComponent(email)}` : ''}`}
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          ) : (
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <Link
                href={`/signup?redirectTo=${encodeURIComponent(redirectTo)}${email ? `&email=${encodeURIComponent(email)}` : ''}`}
                className="text-primary hover:underline font-medium"
              >
                Create one
              </Link>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
