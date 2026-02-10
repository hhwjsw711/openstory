/**
 * Billing Gate Dialog
 * Prompts users to add credits or configure BYOK API keys
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Link } from '@tanstack/react-router';
import { CreditCard, KeyRound } from 'lucide-react';

type BillingGateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const BillingGateDialog: React.FC<BillingGateDialogProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set up billing to continue</DialogTitle>
          <DialogDescription>
            This action uses AI credits. Choose how you'd like to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          <Link to="/settings/billing" onClick={() => onOpenChange(false)}>
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <CreditCard className="size-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-base">Add Credits</CardTitle>
                  <CardDescription>
                    Top up your balance to start generating
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/settings/api-keys" onClick={() => onOpenChange(false)}>
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <KeyRound className="size-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-base">
                    Use Your Own API Keys
                  </CardTitle>
                  <CardDescription>
                    Connect your fal.ai and OpenRouter keys to skip credits
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <div className="pt-2">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
