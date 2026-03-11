/**
 * Billing Gate Dialog
 * Prompts users to add credits or configure BYOK API keys
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Link } from '@tanstack/react-router';
import { ChevronRight, CreditCard, Gift, KeyRound } from 'lucide-react';

const RETURN_KEY = 'openstory:billing-return';

function setReturnPath(returnTo?: string) {
  const path =
    returnTo ??
    (typeof window !== 'undefined' ? window.location.pathname : '/');
  localStorage.setItem(RETURN_KEY, path);
}

type BillingGateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasFalKey?: boolean;
  hasOpenRouterKey?: boolean;
  hasCredits?: boolean;
  returnTo?: string;
};

export const BillingGateDialog: React.FC<BillingGateDialogProps> = ({
  open,
  onOpenChange,
  hasFalKey = false,
  hasOpenRouterKey = false,
  returnTo,
}) => {
  const byokPartial = hasFalKey || hasOpenRouterKey;

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
          <Link
            to="/settings/billing"
            onClick={() => {
              setReturnPath(returnTo);
              onOpenChange(false);
            }}
          >
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <CreditCard className="size-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-base">Add Credits</CardTitle>
                  <CardDescription>
                    Pay as you go. Auto top-up keeps you generating without
                    interruption.
                  </CardDescription>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </CardHeader>
            </Card>
          </Link>

          <Link
            to="/settings/gift-codes"
            onClick={() => {
              setReturnPath(returnTo);
              onOpenChange(false);
            }}
          >
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Gift className="size-5 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <CardTitle className="text-base">Redeem Gift Code</CardTitle>
                <CardDescription>
                  Have a gift code? Redeem it to add credits instantly.
                </CardDescription>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Card>
          </Link>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <Link
            to="/settings/api-keys"
            onClick={() => {
              setReturnPath(returnTo);
              onOpenChange(false);
            }}
          >
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <KeyRound className="size-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      Use Your Own API Keys
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Connect fal.ai and OpenRouter. Pay providers directly.
                  </CardDescription>
                  {byokPartial && (
                    <div className="flex gap-1.5 pt-1">
                      <Badge
                        variant={hasFalKey ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {hasFalKey ? 'fal.ai connected' : 'fal.ai needed'}
                      </Badge>
                      <Badge
                        variant={hasOpenRouterKey ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {hasOpenRouterKey
                          ? 'OpenRouter connected'
                          : 'OpenRouter needed'}
                      </Badge>
                    </div>
                  )}
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
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
