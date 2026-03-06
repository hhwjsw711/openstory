/**
 * Passkey Registration Prompt Modal
 * Shows after OTP login to suggest adding a passkey for faster future logins
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { authClient } from '@/lib/auth/client';
import { Fingerprint } from 'lucide-react';
import { useState } from 'react';

const PASSKEY_SKIP_KEY = 'openstory-passkey-skip';

export function hasSkippedPasskeyPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PASSKEY_SKIP_KEY) === 'true';
}

export function setPasskeySkipped(): void {
  localStorage.setItem(PASSKEY_SKIP_KEY, 'true');
}

type PasskeyPromptModalProps = {
  open: boolean;
  onComplete: () => void;
};

export function PasskeyPromptModal({
  open,
  onComplete,
}: PasskeyPromptModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddPasskey = async () => {
    setError(null);
    setIsLoading(true);

    const result = await authClient.passkey.addPasskey();

    if (result?.error) {
      setError(result.error.message || 'Failed to add passkey');
      setIsLoading(false);
      return;
    }

    onComplete();
  };

  const handleSkip = () => {
    setPasskeySkipped();
    onComplete();
  };

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Fingerprint className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            Add passkey for faster login?
          </DialogTitle>
          <DialogDescription className="text-center">
            Sign in instantly with Face ID, Touch ID, or your device PIN. No
            more codes to enter.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={() => void handleAddPasskey()} disabled={isLoading}>
            {isLoading ? 'Adding…' : 'Add passkey'}
          </Button>
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isLoading}
            className="text-muted-foreground"
          >
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
