import { createFileRoute, redirect } from '@tanstack/react-router';
import { sessionQueryOptions } from '@/lib/auth/session-query';
import { HeroSection } from '@/components/marketing/hero-section';
import { ManifestoSection } from '@/components/marketing/manifesto-section';
import { ProductShowcase } from '@/components/marketing/product-showcase';
import { TopTierFeatures } from '@/components/marketing/feature-cards';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { OpenFairSection } from '@/components/marketing/open-fair-section';
import { FaqSection } from '@/components/marketing/faq-section';

export const Route = createFileRoute('/_marketing/')({
  component: HomePage,
  beforeLoad: async ({ context }) => {
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (session?.user) {
      throw redirect({ to: '/sequences/new' });
    }
  },
  head: () => ({
    meta: [
      { title: 'OpenStory \u2014 Open Source Script-to-Video' },
      {
        property: 'og:title',
        content: 'OpenStory \u2014 Open Source Script-to-Video',
      },
      {
        property: 'og:description',
        content:
          'Open source AI video generation. Script to video, multi-model AI, MIT licensed.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
    ],
  }),
});

function HomePage() {
  return (
    <main>
      <HeroSection />
      <ManifestoSection />
      <ProductShowcase />
      <TopTierFeatures />
      <OpenFairSection />
      <HowItWorks />
      <FaqSection />
    </main>
  );
}
