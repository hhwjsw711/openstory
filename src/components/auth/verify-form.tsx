/**
 * OTP Verification Form Component
 * Auto-verifies when 6 digits entered or pasted
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { authClient } from '@/lib/auth/client';
import { Route as inviteCodeRoute } from '@/routes/_auth/invite-code';
import { Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

function hasSkippedPasskeyPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('velro-passkey-skip') === 'true';
}

type VerifyFormProps = {
  email: string;
  redirectTo?: string;
};

export function VerifyForm({
  email,
  redirectTo = '/sequences',
}: VerifyFormProps) {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isVerifyingRef = useRef(false);

  const verifyOtp = useCallback(
    async (otpValue: string) => {
      if (isVerifyingRef.current || isLoading) return;
      isVerifyingRef.current = true;

      setError(null);
      setSuccess(null);
      setIsLoading(true);

      try {
        const result = await authClient.signIn.emailOtp({
          email,
          otp: otpValue,
        });

        if (result.error) {
          setError(result.error.message || 'Invalid code');
          setIsLoading(false);
          isVerifyingRef.current = false;
          return;
        }

        // Check if new user (needs invite code)
        const user = result.data?.user;
        if (user && 'status' in user && user.status === 'pending') {
          setSuccess('Signed in! Please enter your invite code…');
          await navigate({
            to: inviteCodeRoute.fullPath,
            search: { redirectTo },
          });
        } else {
          setSuccess('Signed in!');
          // Redirect to passkey setup if user hasn't skipped it
          if (!hasSkippedPasskeyPrompt()) {
            await navigate({
              to: '/settings/passkeys',
              search: { setup: true },
            });
          } else {
            await navigate({ to: redirectTo });
          }
        }
      } catch (err) {
        console.error('[VerifyForm] Verify OTP error:', err);
        setError(err instanceof Error ? err.message : 'Verification failed');
        setIsLoading(false);
        isVerifyingRef.current = false;
      }
    },
    [email, navigate, redirectTo, isLoading]
  );

  // Auto-verify when OTP is complete (6 digits)
  useEffect(() => {
    if (otp.length === 6) {
      void verifyOtp(otp);
    }
  }, [otp, verifyOtp]);

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void verifyOtp(otp);
  };

  const handleResendOtp = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });

      if (result.error) {
        setError(result.error.message || 'Failed to resend code');
        setIsLoading(false);
        return;
      }

      setSuccess('New code sent!');
      setOtp('');
      setIsLoading(false);
      isVerifyingRef.current = false;
    } catch (err) {
      console.error('[VerifyForm] Resend OTP error:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend code');
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>Enter the code sent to {email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="flex flex-col items-center gap-4">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              disabled={isLoading}
              autoFocus
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || otp.length !== 6}
          >
            {isLoading ? 'Verifying…' : 'Verify'}
          </Button>
        </form>

        <div className="flex justify-between text-sm">
          <Link
            to="/login"
            search={{ redirectTo }}
            className="text-muted-foreground hover:underline"
          >
            &larr; Back
          </Link>
          <button
            type="button"
            onClick={() => void handleResendOtp()}
            className="text-primary hover:underline"
            disabled={isLoading}
          >
            Resend code
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
