/**
 * Reset Password Page
 * Allows users to set a new password via reset token
 */

'use client';

import { useState } from 'react';
import { PageContainer } from '@/components/layout';
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
import { Route as forgotPasswordRoute } from '@/routes/_auth/forgot-password';
import { Route as loginRoute } from '@/routes/_auth/login';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
});

function ResetPasswordForm() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const token = search.token;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Invalid or missing reset token. Please request a new password reset
            link.
          </AlertDescription>
        </Alert>
        <div className="text-center">
          <Link
            to={forgotPasswordRoute.fullPath}
            className="text-primary hover:underline text-sm"
          >
            Request new reset link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
      });

      if (result.error) {
        setError(result.error.message || 'Failed to reset password');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate({ to: loginRoute.fullPath }), 3000);
    } catch (err) {
      console.error('[ResetPassword] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset password');
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            Password reset successfully! Redirecting to login...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          required
          minLength={8}
        />
        <p className="text-sm text-muted-foreground">
          Must be at least 8 characters
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          required
          minLength={8}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Resetting...' : 'Reset Password'}
      </Button>

      <div className="text-center text-sm pt-4 border-t">
        <Link to={loginRoute.fullPath} className="text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}

function ResetPasswordPage() {
  return (
    <PageContainer>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Reset Password</h1>
            <p className="mt-2 text-muted-foreground">
              Enter your new password below
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>New Password</CardTitle>
              <CardDescription>
                Choose a strong password for your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResetPasswordForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
