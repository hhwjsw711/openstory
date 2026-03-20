import { createFileRoute } from '@tanstack/react-router';
import { OgImageLinkedIn } from '@/components/marketing/og-image-linkedin';

export const Route = createFileRoute('/meta/og-linkedin')({
  component: OgImageLinkedIn,
});
