'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getRedirectFromParams } from '@/lib/auth/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type InviteCodeFormProps = {
  redirectTo?: string;
};

export const InviteCodeForm: React.FC<InviteCodeFormProps> = ({
  redirectTo = '/sequences',
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/invite-codes/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to activate account');
        setIsLoading(false);
        return;
      }

      // Success! Invalidate session cache and redirect
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      await queryClient.invalidateQueries({ queryKey: ['current-user'] });

      // Validate redirect URL to prevent open redirects
      const validatedRedirect = getRedirectFromParams({ redirectTo });

      // Use window.location for hard refresh to ensure session is updated
      window.location.href = validatedRedirect;
    } catch (err) {
      console.error('Activation error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="invite-code" className="text-sm font-medium">
          Invite Code
        </label>
        <Input
          id="invite-code"
          name="invite-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter your invite code"
          required
          autoComplete="off"
          disabled={isLoading}
          className="uppercase"
        />
        <p className="text-sm text-muted-foreground">
          Enter the invite code you received to join Velro
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Activating…' : 'Continue'}
      </Button>
    </form>
  );
};
