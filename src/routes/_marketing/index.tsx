import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { sessionQueryOptions } from '@/lib/auth/session-query';
import { HeroSection } from '@/components/marketing/hero-section';
import { ManifestoSection } from '@/components/marketing/manifesto-section';
import { ProductShowcase } from '@/components/marketing/product-showcase';
import { TopTierFeatures } from '@/components/marketing/feature-cards';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { OpenFairSection } from '@/components/marketing/open-fair-section';
import { FaqSection } from '@/components/marketing/faq-section';
import { OgImage } from '@/components/marketing/og-image';
import { FAQ_ITEMS, SITE_CONFIG } from '@/lib/marketing/constants';

const title = 'OpenStory \u2014 Open Source Script-to-Video';
const description =
  'Open source AI video generation. Script to video, multi-model AI, MIT licensed.';

const searchSchema = z.object({
  og: z.boolean().optional(),
});

export const Route = createFileRoute('/_marketing/')({
  component: HomePage,
  validateSearch: searchSchema,
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
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQ_ITEMS.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        }),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: SITE_CONFIG.name,
          description: SITE_CONFIG.description,
          url: SITE_CONFIG.url,
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'Web',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          isAccessibleForFree: true,
          license: `${SITE_CONFIG.githubHref}/blob/main/LICENSE`,
        }),
      },
    ],
  }),
});

function HomePage() {
  const { og } = Route.useSearch();

  if (og) {
    return <OgImage />;
  }

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
