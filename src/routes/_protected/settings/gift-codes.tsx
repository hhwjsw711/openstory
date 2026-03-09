import { createFileRoute } from '@tanstack/react-router';
import { GiftCodeSettings } from '@/components/settings/gift-code-settings';

export const Route = createFileRoute('/_protected/settings/gift-codes')({
  component: GiftCodesPage,
});

function GiftCodesPage() {
  return <GiftCodeSettings />;
}
