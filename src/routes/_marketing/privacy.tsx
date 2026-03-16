import { createFileRoute } from '@tanstack/react-router';
import { SITE_CONFIG } from '@/lib/marketing/constants';

const title = 'Privacy Policy \u2014 OpenStory';

export const Route = createFileRoute('/_marketing/privacy')({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title },
      { property: 'og:title', content: title },
      { property: 'og:url', content: `${SITE_CONFIG.url}/privacy` },
      { name: 'twitter:title', content: title },
    ],
  }),
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-32">
      <h1 className="font-heading text-4xl font-bold tracking-tight">
        Privacy Policy
      </h1>
      <p className="mt-4 text-muted-foreground">Coming soon.</p>
    </main>
  );
}
