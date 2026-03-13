import { createFileRoute, redirect } from '@tanstack/react-router';
import { sessionQueryOptions } from '@/lib/auth/session-query';
import { SITE_CONFIG } from '@/lib/marketing/constants';
import { HeroSection } from '@/components/marketing/hero-section';
import { ManifestoSection } from '@/components/marketing/manifesto-section';
import { ProductShowcase } from '@/components/marketing/product-showcase';
import { TopTierFeatures } from '@/components/marketing/feature-cards';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { OpenFairSection } from '@/components/marketing/open-fair-section';
import { FaqSection } from '@/components/marketing/faq-section';

const title = 'OpenStory \u2014 Open Source Script-to-Video';
const description =
  'Open source AI video generation. Script to video, multi-model AI, MIT licensed.';

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
      { title },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: SITE_CONFIG.url },
      { property: 'og:image', content: SITE_CONFIG.ogImage },
      { property: 'og:site_name', content: SITE_CONFIG.name },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: SITE_CONFIG.ogImage },
      { name: 'twitter:url', content: SITE_CONFIG.url },
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
