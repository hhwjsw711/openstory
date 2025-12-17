import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { activateInviteCodeFn } from '@/functions/invite-codes';
import { getRedirectFromParams } from '@/lib/auth/navigation';
import { Route as sequencesRoute } from '@/routes/_protected/sequences/index';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

type InviteCodeFormProps = {
  redirectTo?: string;
};

export const InviteCodeForm: React.FC<InviteCodeFormProps> = ({
  redirectTo = sequencesRoute.fullPath,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await activateInviteCodeFn({ data: { code } });

      // Success! Invalidate session cache and redirect
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      await queryClient.invalidateQueries({ queryKey: ['current-user'] });

      // Validate redirect URL to prevent open redirects
      const validatedRedirect = getRedirectFromParams({ redirectTo });

      // Navigate to validated redirect
      void navigate({ to: validatedRedirect, replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to activate account';
      setError(message);
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
