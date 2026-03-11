import { useEffect, useState } from 'react';
import { VideoIcon } from '@/components/icons/video-icon';
import { BillingGateDialog } from '@/components/billing/billing-gate-dialog';
import { PageContainer } from '@/components/layout/page-container';
import { PageDescription } from '@/components/typography/page-description';
import { PageHeader } from '@/components/typography/page-header';
import { PageHeading } from '@/components/typography/page-heading';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SequencesList } from '@/components/sequence/sequences-list';
import { useBillingGate } from '@/hooks/use-billing-gate';
import { useSequences } from '@/hooks/use-sequences';
import { Route as sequencesNewRoute } from '@/routes/_protected/sequences/new';
import { createFileRoute, Link } from '@tanstack/react-router';

const BILLING_PROMPT_KEY = 'openstory:billing-prompt-dismissed';
const BILLING_PROMPT_EXPIRY_DAYS = 1;

function wasBillingPromptDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(BILLING_PROMPT_KEY);
  if (!raw) return false;
  const expiry = Number(raw);
  if (Date.now() > expiry) {
    localStorage.removeItem(BILLING_PROMPT_KEY);
    return false;
  }
  return true;
}

function dismissBillingPrompt() {
  const expiry = Date.now() + BILLING_PROMPT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(BILLING_PROMPT_KEY, String(expiry));
}

export const Route = createFileRoute('/_protected/sequences/')({
  component: SequencesPage,
});

function SequencesPage() {
  const { data: sequences, isLoading } = useSequences();
  const { needsBillingSetup, hasFalKey, hasOpenRouterKey } = useBillingGate();
  const [billingOpen, setBillingOpen] = useState(false);

  useEffect(() => {
    if (needsBillingSetup && !wasBillingPromptDismissed()) {
      setBillingOpen(true);
    }
  }, [needsBillingSetup]);

  return (
    <div className="h-full overflow-auto">
      <BillingGateDialog
        open={billingOpen}
        onOpenChange={(open) => {
          setBillingOpen(open);
          if (!open) dismissBillingPrompt();
        }}
        hasFalKey={hasFalKey}
        hasOpenRouterKey={hasOpenRouterKey}
        context="onboarding"
      />
      <PageContainer>
        <PageHeader
          actions={
            <Button asChild>
              <Link to={sequencesNewRoute.fullPath}>Create New Sequence</Link>
            </Button>
          }
        >
          <PageHeading>Your Sequences</PageHeading>
          <PageDescription>
            Manage and view all your video sequences in one place.
          </PageDescription>
        </PageHeader>

        {!isLoading && sequences && sequences.length === 0 ? (
          <EmptyState
            icon={<VideoIcon size="xl" />}
            title="No sequences yet"
            description="Get started by creating your first video sequence. Transform your script into professional video content with AI assistance."
            action={
              <Button asChild size="lg">
                <Link to={sequencesNewRoute.fullPath}>
                  Create Your First Sequence
                </Link>
              </Button>
            }
          />
        ) : (
          <SequencesList />
        )}
      </PageContainer>
    </div>
  );
}
