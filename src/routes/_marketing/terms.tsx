import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_marketing/terms')({
  component: TermsPage,
  head: () => ({
    meta: [{ title: 'Terms of Service \u2014 OpenStory' }],
  }),
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-32">
      <h1 className="font-heading text-4xl font-bold tracking-tight">
        Terms of Service
      </h1>
      <p className="mt-4 text-muted-foreground">Coming soon.</p>
    </main>
  );
}
